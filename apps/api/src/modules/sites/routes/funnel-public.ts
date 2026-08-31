import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findPublishedTenantBySubdomain } from "../lib/site-store.js";
import { findPublishedFunnel, getFunnelPackages } from "../lib/funnel-store.js";
import { findCartByToken, createCart, serializeCart, addItemToCart } from "../../cart/lib/cart-store.js";
import { getCartTokenCookie, setCartTokenCookie } from "../../cart/lib/cart-cookie.js";

const addFunnelPackageToCartSchema = z.object({
  packageId: z.string().min(1),
});

export default async function funnelPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string; productId: string } }>(
    "/public/sites/:subdomain/funnel/:productId",
    async (request, reply) => {
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }
      const funnel = await findPublishedFunnel(db, tenant, request.params.productId);
      if (!funnel) {
        return reply.code(404).send({ error: "funnel_not_found" });
      }
      return reply.send(funnel);
    },
  );

  app.post<{ Params: { subdomain: string; productId: string } }>(
    "/public/sites/:subdomain/funnel/:productId/add-to-cart",
    async (request, reply) => {
      const body = addFunnelPackageToCartSchema.parse(request.body);
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }
      const funnel = await findPublishedFunnel(db, tenant, request.params.productId);
      if (!funnel) {
        return reply.code(404).send({ error: "funnel_not_found" });
      }

      // Server-resolved from the published funnel config - never trust a
      // client-sent price/quantity for the package.
      const pkg = getFunnelPackages(funnel.sections).find((p) => p.id === body.packageId);
      if (!pkg) {
        return reply.code(400).send({ error: "invalid_package" });
      }

      // Funnel pages skip the cart UI entirely, but still use the same
      // tenant-scoped cart under the hood so checkout.ts needs no changes.
      const existingToken = getCartTokenCookie(request, request.params.subdomain);
      let cart = existingToken ? await findCartByToken(db, tenant.id, existingToken) : null;
      if (!cart) {
        const created = await createCart(db, tenant.id);
        cart = created.cart;
        setCartTokenCookie(reply, request.params.subdomain, created.token);
      }

      const unitPriceOverrideCents = Math.round(pkg.priceCents / pkg.quantity);
      const result = await addItemToCart(
        db,
        tenant.id,
        cart.id,
        request.params.productId,
        pkg.quantity,
        undefined,
        unitPriceOverrideCents,
      );
      if (!result.ok) {
        return reply.code(400).send({ error: result.reason });
      }

      return reply.send(await serializeCart(db, cart));
    },
  );
}
