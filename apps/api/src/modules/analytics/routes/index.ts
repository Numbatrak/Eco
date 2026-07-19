import type { FastifyInstance } from "fastify";
import analyticsSettingsRoutes from "./settings.js";

export default async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(analyticsSettingsRoutes);
}
