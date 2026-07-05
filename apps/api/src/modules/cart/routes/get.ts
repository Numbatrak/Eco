import type { FastifyInstance } from "fastify";
import { resolveCartContext, isCartContextError } from "../lib/cart-request.js";
import { serializeCart } from "../lib/cart-store.js";

export default async function getCartRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/cart",
    async (request, reply) => {
      const ctx = await resolveCartContext(app, request, request.params.subdomain);
      if (isCartContextError(ctx)) {
        return reply.code(404).send({ error: ctx.error });
      }
      const db = app.getDb();
      return reply.send(await serializeCart(db, ctx.cart));
    },
  );
}
