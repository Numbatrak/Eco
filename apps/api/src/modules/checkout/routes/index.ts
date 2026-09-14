import type { FastifyInstance } from "fastify";
import checkoutRoutes from "./checkout.js";
import checkoutStatusRoutes from "./status.js";
import sweepAbandonedCronRoutes from "./sweep-abandoned-cron.js";

export default async function checkoutModuleRoutes(app: FastifyInstance): Promise<void> {
  await app.register(checkoutRoutes);
  await app.register(checkoutStatusRoutes);
  await app.register(sweepAbandonedCronRoutes);
}
