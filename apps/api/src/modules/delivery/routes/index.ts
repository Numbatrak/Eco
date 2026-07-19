import type { FastifyInstance } from "fastify";
import deliveryQuoteRoutes from "./quote.js";
import deliverySettingsRoutes from "./settings.js";

export default async function deliveryRoutes(app: FastifyInstance): Promise<void> {
  await app.register(deliveryQuoteRoutes);
  await app.register(deliverySettingsRoutes);
}
