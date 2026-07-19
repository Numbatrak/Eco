import type { FastifyInstance } from "fastify";
import { siteConfigSchema } from "@platform/shared-types";
import { findSiteConfigByTenant, publishSite, saveSiteConfig } from "../lib/site-store.js";

export default async function siteConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/site-config",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const config = await findSiteConfigByTenant(app.getDb(), request.activeOrganizationId!);
      return reply.send(config);
    },
  );

  app.put(
    "/org/site-config",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = siteConfigSchema.parse(request.body);
      await saveSiteConfig(app.getDb(), request.activeOrganizationId!, body);
      return reply.code(204).send();
    },
  );

  app.post(
    "/org/site-config/publish",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      await publishSite(app.getDb(), request.activeOrganizationId!);
      return reply.code(204).send();
    },
  );
}
