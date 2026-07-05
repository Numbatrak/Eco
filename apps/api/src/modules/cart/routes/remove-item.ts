import type { FastifyInstance } from "fastify";
import { resolveCartContext, isCartContextError } from "../lib/cart-request.js";
import { removeCartItem, serializeCart } from "../lib/cart-store.js";

export default async function removeCartItemRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { subdomain: string; itemId: string } }>(
    "/public/sites/:subdomain/cart/items/:itemId",
    async (request, reply) => {
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }
      const db = app.getDb();
      const removed = await removeCartItem(db, ctx.cart.id, request.params.itemId);
      if (!removed) {
        return reply.code(404).send({ error: "item_not_found" });
      }
      return reply.send(await serializeCart(db, ctx.cart));
    },
  );
}
