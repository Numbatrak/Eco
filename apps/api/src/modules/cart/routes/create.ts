import type { FastifyInstance } from "fastify";
import { findPublishedTenantBySubdomain } from "../../sites/lib/site-store.js";
import { createCart, serializeCart } from "../lib/cart-store.js";
import { setCartTokenCookie } from "../lib/cart-cookie.js";

export default async function createCartRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/cart",
    async (request, reply) => {
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }
      const { cart, token } = await createCart(db, tenant.id);
      setCartTokenCookie(reply, request.params.subdomain, token);
      return reply.code(201).send(await serializeCart(db, cart));
    },
  );
}
