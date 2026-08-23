import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenantSiteConfig } from "@platform/db";
import { updateTenantRequestSchema, type TenantSettingsResponse } from "@platform/shared-types";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import { ensureTenantSiteConfig, findTenantSettings } from "../lib/site-store.js";

export default async function tenantSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/site-settings",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const tenantId = request.activeOrganizationId!;
      await ensureTenantSiteConfig(db, tenantId);
      const settings = await findTenantSettings(db, tenantId);
      if (!settings) {
        return reply.code(404).send({ error: "Tenant not found" });
      }
      const response: TenantSettingsResponse = settings;
      return reply.send(response);
    },
  );

  app.patch(
    "/org/site-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = updateTenantRequestSchema.parse(request.body);
      const db = app.getDb();
      const tenantId = request.activeOrganizationId!;
      await ensureTenantSiteConfig(db, tenantId);

      if (body.subdomain !== undefined) {
        // Format/reserved-word/uniqueness checks live solely in the
        // organization plugin's beforeUpdateOrganization hook now (../../../lib/auth.ts).
        await auth.api.updateOrganization({
          headers: fromNodeHeaders(request.headers),
          body: { organizationId: tenantId, data: { slug: body.subdomain.toLowerCase() } },
        });
      }

      if (body.published !== undefined) {
        await db
          .update(tenantSiteConfig)
          .set({ publishedAt: body.published ? new Date() : null, updatedAt: new Date() })
          .where(eq(tenantSiteConfig.tenantId, tenantId));
      }

      if (body.showProductGrid !== undefined) {
        await db
          .update(tenantSiteConfig)
          .set({ productsGridEnabled: body.showProductGrid, updatedAt: new Date() })
          .where(eq(tenantSiteConfig.tenantId, tenantId));
      }

      return reply.code(204).send();
    },
  );
}
