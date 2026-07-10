import type { FastifyInstance } from "fastify";
import { findPublishedSiteBySubdomain } from "../lib/site-store.js";

export default async function resolveSiteRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string } }>("/public/sites/:subdomain", async (request, reply) => {
    const db = app.getDb();
    const result = await findPublishedSiteBySubdomain(db, request.params.subdomain);

    if (result.kind === "not_found") {
      // A distinct, stable shape so the storefront can tell "no such site"
      // apart from a transient/real error.
      return reply.code(404).send({
        error: "site_not_found",
        message: "No published site exists for this subdomain.",
      });
    }
    if (result.kind === "suspended") {
      // Deliberately distinct from site_not_found (403, not 404) so the
      // renderer can show "temporarily unavailable" instead of a 404 page.
      return reply.code(403).send({
        error: "site_suspended",
        message: "This site is temporarily unavailable.",
      });
    }
    return reply.send(result.site);
  });
}
