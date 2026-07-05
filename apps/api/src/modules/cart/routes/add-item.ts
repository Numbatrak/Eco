import type { FastifyInstance } from "fastify";
import { addCartItemRequestSchema } from "@platform/shared-types";
import { resolveCartContext, isCartContextError } from "../lib/cart-request.js";
import { addItemToCart, serializeCart } from "../lib/cart-store.js";

export default async function addCartItemRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/cart/items",
    async (request, reply) => {
      const body = addCartItemRequestSchema.parse(request.body);
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }
      const db = app.getDb();
      const result = await addItemToCart(
        db,
        ctx.tenant.id,
        ctx.cart.id,
        body.productId,
        body.quantity,
      );
      if (!result.ok) {
        return reply.code(400).send({ error: result.reason });
      }
      return reply.send(await serializeCart(db, ctx.cart));
    },
  );
}
