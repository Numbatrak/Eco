import type { FastifyInstance } from "fastify";
import checkoutRoutes from "./checkout.js";
import checkoutStatusRoutes from "./status.js";

export default async function checkoutModuleRoutes(app: FastifyInstance): Promise<void> {
  await app.register(checkoutRoutes);
  await app.register(checkoutStatusRoutes);
}
