import type { FastifyInstance } from "fastify";
import paymentSettingsRoutes from "./settings.js";
import webhookRoutes from "./webhooks.js";

export default async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(paymentSettingsRoutes);
  await app.register(webhookRoutes);
}
