import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenants, tenantSiteConfig } from "@platform/db";
import { updateTenantRequestSchema } from "@platform/shared-types";
import { isValidSubdomainFormat, isReservedSubdomain } from "../lib/subdomain.js";
import { findTenantBySubdomain } from "../lib/site-store.js";

export default async function tenantSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { tenantId: string } }>(
    "/tenants/:tenantId",
    { preHandler: [app.authenticate, app.requireTenantRole(["owner"])] },
    async (request, reply) => {
      const body = updateTenantRequestSchema.parse(request.body);
      const db = app.getDb();
      const { tenantId } = request.params;

      if (body.subdomain !== undefined) {
        const candidate = body.subdomain.toLowerCase();
        if (!isValidSubdomainFormat(candidate)) {
          return reply.code(400).send({ error: "Invalid subdomain format" });
        }
        if (isReservedSubdomain(candidate)) {
          return reply.code(409).send({ error: "This subdomain is reserved" });
        }
        const existing = await findTenantBySubdomain(db, candidate);
        if (existing && existing.id !== tenantId) {
          return reply.code(409).send({ error: "This subdomain is already taken" });
        }
        await db.update(tenants).set({ subdomain: candidate }).where(eq(tenants.id, tenantId));
      }

      if (body.published !== undefined) {
        await db
          .update(tenantSiteConfig)
          .set({ publishedAt: body.published ? new Date() : null, updatedAt: new Date() })
          .where(eq(tenantSiteConfig.tenantId, tenantId));
      }

      return reply.code(204).send();
    },
  );
}
