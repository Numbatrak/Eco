import type { FastifyInstance } from "fastify";
import { checkoutRequestSchema, type CheckoutResponse } from "@platform/shared-types";
import { resolveCartContext, isCartContextError } from "../../cart/lib/cart-request.js";
import { serializeCart, findUnpublishedCartItems, deleteCart } from "../../cart/lib/cart-store.js";
import { clearCartTokenCookie } from "../../cart/lib/cart-cookie.js";
import { findPaymentSettings } from "../../payments/lib/payment-settings-store.js";
import { buildProvider } from "../../payments/lib/provider-factory.js";
import { checkAndIncrementRateLimit } from "../../auth/lib/rate-limit.js";
import { createPendingOrder, setOrderPaymentReference } from "../lib/orders.js";
import { buildCheckoutCallbackUrl } from "../lib/callback-url.js";

const CHECKOUT_RATE_LIMIT_WINDOW_SECONDS = 60;

function checkoutRateLimitPerMinute(): number {
  const raw = process.env.CHECKOUT_RATE_LIMIT_PER_MINUTE;
  return raw ? Number(raw) : 10;
}

export default async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/checkout",
    async (request, reply) => {
      const redis = app.getRedis();
      const rate = await checkAndIncrementRateLimit(redis, `checkout:ip:${request.ip}`, {
        limit: checkoutRateLimitPerMinute(),
        windowSeconds: CHECKOUT_RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rate.allowed) {
        return reply
          .code(429)
          .send({ error: "Too many checkout attempts. Please try again shortly." });
      }

      const body = checkoutRequestSchema.parse(request.body);
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }

      const db = app.getDb();
      const cart = await serializeCart(db, ctx.cart);
      if (cart.items.length === 0) {
        return reply.code(400).send({ error: "cart_empty" });
      }

      const unpublished = await findUnpublishedCartItems(db, ctx.cart.id);
      if (unpublished.length > 0) {
        return reply.code(400).send({
          error: "cart_has_unpublished_items",
          message: "One or more items in your cart are no longer available.",
        });
      }

      const settings = await findPaymentSettings(db, ctx.tenant.id);
      const provider = settings ? buildProvider(settings) : null;
      if (!settings || !provider) {
        return reply.code(400).send({ error: "payments_not_configured" });
      }

      // Multi-currency conversion is out of scope - reject rather than silently mixing.
      const currency = cart.currency;
      if (!currency) {
        return reply.code(400).send({ error: "cart_empty" });
      }

      const order = await createPendingOrder(db, {
        tenantId: ctx.tenant.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        currency,
        subtotalCents: cart.subtotalCents,
        totalCents: cart.subtotalCents,
        paymentProvider: settings.provider,
        items: cart.items.map((item) => ({
          productId: item.productId,
          nameSnapshot: item.name,
          unitPriceSnapshotCents: item.unitPriceSnapshotCents,
          quantity: item.quantity,
        })),
      });

      const callbackUrl = buildCheckoutCallbackUrl(request.params.subdomain, order.id);
      const { checkoutUrl, reference } = await provider.initializeTransaction({
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        currency: order.currency,
        customerEmail: order.customerEmail,
        callbackUrl,
      });
      await setOrderPaymentReference(db, order.id, reference);

      await deleteCart(db, ctx.cart.id);
      clearCartTokenCookie(reply, request.params.subdomain);

      const response: CheckoutResponse = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutUrl,
      };
      return reply.code(201).send(response);
    },
  );
}
