import type { FastifyInstance } from "fastify";
import resolveSiteRoutes from "./resolve.js";
import tenantSettingsRoutes from "./tenant-settings.js";
import siteConfigRoutes from "./site-config.js";
import funnelPublicRoutes from "./funnel-public.js";

export default async function sitesRoutes(app: FastifyInstance): Promise<void> {
  await app.register(resolveSiteRoutes);
  await app.register(tenantSettingsRoutes);
  await app.register(siteConfigRoutes);
  await app.register(funnelPublicRoutes);
}
