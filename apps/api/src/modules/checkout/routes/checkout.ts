import type { FastifyInstance } from "fastify";
import { checkoutRequestSchema, type CheckoutResponse, type DiscountConfig } from "@platform/shared-types";
import { resolveCartContext, isCartContextError } from "../../cart/lib/cart-request.js";
import {
  buildCartSummary,
  getCartItemsWithProduct,
  findUnpublishedCartItems,
  deleteCart,
} from "../../cart/lib/cart-store.js";
import { clearCartTokenCookie } from "../../cart/lib/cart-cookie.js";
import { findPaymentSettings } from "../../payments/lib/payment-settings-store.js";
import { buildProvider } from "../../payments/lib/provider-factory.js";
import { checkAndIncrementRateLimit } from "../../auth/lib/rate-limit.js";
import { createPendingOrder, setOrderPaymentReference, markOrderPaid } from "../lib/orders.js";
import { buildCheckoutCallbackUrl } from "../lib/callback-url.js";
import {
  findDeliverySettings,
  serializeDeliverySettings,
} from "../../delivery/lib/delivery-settings-store.js";
import { findZoneRate } from "../../delivery/lib/delivery-zone-store.js";
import { quoteDelivery } from "../../delivery/lib/quote.js";
import { upsertCustomer } from "../../customers/lib/customers.js";
import { findActiveByCode, listActiveAutomatic, type DiscountRow } from "../../discounts/lib/discounts-store.js";
import { computeDiscount } from "../../discounts/lib/apply-discount.js";

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
      const cartRows = await getCartItemsWithProduct(db, ctx.cart.id);
      const cart = buildCartSummary(ctx.cart.id, cartRows);
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
      // Missing settings row = brand-new tenant that's never touched
      // payments - default to COD so checkout works with zero gateway
      // setup, instead of hard-failing every store until Paystack is wired up.
      const collectionMethod = settings?.collectionMethod ?? "cod";

      let paymentMethod: "cod" | "online";
      if (collectionMethod === "cod") {
        paymentMethod = "cod";
      } else if (collectionMethod === "prepaid") {
        paymentMethod = "online";
      } else {
        if (body.paymentMethod !== "cod" && body.paymentMethod !== "online") {
          return reply.code(400).send({ error: "payment_method_required" });
        }
        paymentMethod = body.paymentMethod;
      }

      const provider = paymentMethod === "online" && settings ? buildProvider(settings) : null;
      if (paymentMethod === "online" && (!settings || !provider)) {
        return reply.code(400).send({ error: "payments_not_configured" });
      }

      // Multi-currency conversion is out of scope - reject rather than silently mixing.
      const currency = cart.currency;
      if (!currency) {
        return reply.code(400).send({ error: "cart_empty" });
      }

      // Resolve the discount: an explicitly entered code must be valid (fails
      // checkout otherwise, rather than silently checking out at full price);
      // with no code, the first eligible automatic discount applies. One
      // discount per order - no stacking.
      let discount: DiscountRow | null = null;
      if (body.discountCode) {
        discount = await findActiveByCode(db, ctx.tenant.id, body.discountCode);
        if (!discount) {
          return reply
            .code(400)
            .send({ error: "invalid_discount_code", message: "This discount code isn't valid." });
        }
      } else {
        const automatic = await listActiveAutomatic(db, ctx.tenant.id);
        for (const candidate of automatic) {
          const config = candidate.config as DiscountConfig;
          const minimum = "minimumSubtotalCents" in config ? config.minimumSubtotalCents : undefined;
          if (minimum == null || cart.subtotalCents >= minimum) {
            discount = candidate;
            break;
          }
        }
      }

      const { amountOffCents, freeShipping } = discount
        ? computeDiscount(discount.config as DiscountConfig, cartRows, cart.subtotalCents)
        : { amountOffCents: 0, freeShipping: false };
      const discountedSubtotalCents = Math.max(0, cart.subtotalCents - amountOffCents);

      const deliverySettingsRow = await findDeliverySettings(db, ctx.tenant.id);
      const deliverySettings = serializeDeliverySettings(deliverySettingsRow);
      const zoneRate = freeShipping ? null : await findZoneRate(db, ctx.tenant.id, body.deliveryState);
      // Server-authoritative recompute (Pattern 1 / Pattern 8) - the browser's
      // /delivery-quote preview is never trusted for the actual charge.
      const quote = quoteDelivery(deliverySettings, {
        preDiscountSubtotalCents: cart.subtotalCents,
        postDiscountSubtotalCents: discountedSubtotalCents,
        zoneFeeCents: freeShipping ? 0 : zoneRate?.feeCents,
      });
      const totalCents = discountedSubtotalCents + quote.feeCents + quote.vat.amountCents;

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
        paymentProvider: paymentMethod === "online" ? settings!.provider : null,
        paymentMethod,
        source: body.source ?? "store",
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
        lastUtmSource: body.lastAttribution?.utmSource,
        lastUtmMedium: body.lastAttribution?.utmMedium,
        lastUtmCampaign: body.lastAttribution?.utmCampaign,
        lastUtmTerm: body.lastAttribution?.utmTerm,
        lastUtmContent: body.lastAttribution?.utmContent,
        lastReferrer: body.lastAttribution?.referrer,
        lastLandingPath: body.lastAttribution?.landingPath,
        lastFbclid: body.lastAttribution?.fbclid,
        lastTtclid: body.lastAttribution?.ttclid,
        lastGclid: body.lastAttribution?.gclid,
        discountId: discount?.id ?? null,
        discountCode: discount?.code ?? null,
        discountAmountCents: amountOffCents,
        items: cart.items.map((item) => ({
          productId: item.productId,
          nameSnapshot: item.name,
          unitPriceSnapshotCents: item.unitPriceSnapshotCents,
          quantity: item.quantity,
        })),
      });

      if (paymentMethod === "cod") {
        // No gateway step at all - the order is confirmed the moment it's
        // placed. Reuses markOrderPaid's existing pending->paid transition
        // and side effects (customer stats, confirmation email/WhatsApp,
        // Meta CAPI) rather than duplicating any of it.
        await markOrderPaid(db, request.log, order);
        await deleteCart(db, ctx.cart.id);
        clearCartTokenCookie(reply, request.params.subdomain);

        const response: CheckoutResponse = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          checkoutUrl: null,
        };
        return reply.code(201).send(response);
      }

      const callbackUrl = buildCheckoutCallbackUrl(request.params.subdomain, order.id);
      const { checkoutUrl, reference } = await provider!.initializeTransaction({
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
