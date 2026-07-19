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
import {
  findDeliverySettings,
  serializeDeliverySettings,
} from "../../delivery/lib/delivery-settings-store.js";
import { quoteDelivery } from "../../delivery/lib/quote.js";
import { upsertCustomer } from "../../customers/lib/customers.js";

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

      const deliverySettingsRow = await findDeliverySettings(db, ctx.tenant.id);
      const deliverySettings = serializeDeliverySettings(deliverySettingsRow);
      // Server-authoritative recompute (Pattern 1 / Pattern 8) - the browser's
      // /delivery-quote preview is never trusted for the actual charge.
      const quote = quoteDelivery(deliverySettings, cart.subtotalCents);
      const totalCents = cart.subtotalCents + quote.feeCents + quote.vat.amountCents;

      const customer = await upsertCustomer(db, ctx.tenant.id, {
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone,
        address: body.deliveryAddress,
        city: body.deliveryCity,
        state: body.deliveryState,
      });

      const order = await createPendingOrder(db, {
        tenantId: ctx.tenant.id,
        customerId: customer.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        currency,
        subtotalCents: cart.subtotalCents,
        deliveryAddress: body.deliveryAddress,
        deliveryCity: body.deliveryCity,
        deliveryState: body.deliveryState,
        deliveryFeeCents: quote.feeCents,
        vatRateBps: quote.vat.enabled ? quote.vat.rateBps : null,
        vatAmountCents: quote.vat.amountCents,
        totalCents,
        paymentProvider: settings.provider,
        utmSource: body.attribution?.utmSource,
        utmMedium: body.attribution?.utmMedium,
        utmCampaign: body.attribution?.utmCampaign,
        utmTerm: body.attribution?.utmTerm,
        utmContent: body.attribution?.utmContent,
        referrer: body.attribution?.referrer,
        landingPath: body.attribution?.landingPath,
        fbclid: body.attribution?.fbclid,
        ttclid: body.attribution?.ttclid,
        gclid: body.attribution?.gclid,
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
