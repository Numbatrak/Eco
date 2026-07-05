import type { FastifyInstance } from "fastify";
import { findPublishedSiteBySubdomain } from "../lib/site-store.js";

export default async function resolveSiteRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string } }>("/public/sites/:subdomain", async (request, reply) => {
    const db = app.getDb();
    const site = await findPublishedSiteBySubdomain(db, request.params.subdomain);
    if (!site) {
      // A distinct, stable shape so the storefront can tell "no such site"
      // apart from a transient/real error.
      return reply.code(404).send({
        error: "site_not_found",
        message: "No published site exists for this subdomain.",
      });
    }
    return reply.send(site);
  });
}
