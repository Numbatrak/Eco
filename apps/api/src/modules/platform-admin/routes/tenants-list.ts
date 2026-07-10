import type { FastifyInstance } from "fastify";
import { platformAdminTenantsQuerySchema, type PlatformAdminTenantsResponse } from "@platform/shared-types";
import { listTenantsForAdmin } from "../lib/tenant-admin.js";

export default async function tenantsListRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/tenants",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const query = platformAdminTenantsQuerySchema.parse(request.query);
      const db = app.getDb();
      const result = await listTenantsForAdmin(db, query);
      const response: PlatformAdminTenantsResponse = {
        tenants: result.tenants,
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      };
      return reply.send(response);
    },
  );
}
