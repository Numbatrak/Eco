import type { FastifyInstance } from "fastify";
import {
  discountCodePreviewRequestSchema,
  type DiscountCodePreviewResponse,
  type DiscountConfig,
} from "@platform/shared-types";
import { resolveCartContext, isCartContextError } from "../../cart/lib/cart-request.js";
import { buildCartSummary, getCartItemsWithProduct } from "../../cart/lib/cart-store.js";
import { findActiveByCode } from "../lib/discounts-store.js";
import { computeDiscount } from "../lib/apply-discount.js";

export default async function discountValidateRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/discount-code/validate",
    async (request, reply) => {
      const body = discountCodePreviewRequestSchema.parse(request.body);
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }

      const db = app.getDb();
      const discount = await findActiveByCode(db, ctx.tenant.id, body.code);
      if (!discount) {
        const response: DiscountCodePreviewResponse = {
          valid: false,
          amountCents: 0,
          freeShipping: false,
          message: "This code isn't valid.",
        };
        return reply.send(response);
      }

      const rows = await getCartItemsWithProduct(db, ctx.cart.id);
      const cart = buildCartSummary(ctx.cart.id, rows);
      const { amountOffCents, freeShipping } = computeDiscount(
        discount.config as DiscountConfig,
        rows,
        cart.subtotalCents,
      );

      if (amountOffCents === 0 && !freeShipping) {
        const response: DiscountCodePreviewResponse = {
          valid: false,
          amountCents: 0,
          freeShipping: false,
          message: "This code doesn't apply to your cart.",
        };
        return reply.send(response);
      }

      const response: DiscountCodePreviewResponse = {
        valid: true,
        amountCents: amountOffCents,
        freeShipping,
        message: null,
      };
      return reply.send(response);
    },
  );
}
