import type { FastifyInstance } from "fastify";
import resolveSiteRoutes from "./resolve.js";
import tenantSettingsRoutes from "./tenant-settings.js";

export default async function sitesRoutes(app: FastifyInstance): Promise<void> {
  await app.register(resolveSiteRoutes);
  await app.register(tenantSettingsRoutes);
}
