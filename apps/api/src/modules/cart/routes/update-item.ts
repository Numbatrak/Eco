import type { FastifyInstance } from "fastify";
import { updateCartItemRequestSchema } from "@platform/shared-types";
import { resolveCartContext, isCartContextError } from "../lib/cart-request.js";
import { updateCartItemQuantity, serializeCart } from "../lib/cart-store.js";

export default async function updateCartItemRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { subdomain: string; itemId: string } }>(
    "/public/sites/:subdomain/cart/items/:itemId",
    async (request, reply) => {
      const body = updateCartItemRequestSchema.parse(request.body);
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }
      const db = app.getDb();
      const updated = await updateCartItemQuantity(
        db,
        ctx.cart.id,
        request.params.itemId,
        body.quantity,
      );
      if (!updated) {
        return reply.code(404).send({ error: "item_not_found" });
      }
      return reply.send(await serializeCart(db, ctx.cart));
    },
  );
}
