import type { FastifyInstance } from "fastify";
import stockGridRoutes from "./grid.js";
import transferMovementRoutes from "./transfer.js";
import adjustMovementRoutes from "./adjust.js";
import listMovementsRoutes from "./movements.js";

export default async function numbatrakInventoryRoutes(app: FastifyInstance): Promise<void> {
  await app.register(stockGridRoutes);
  await app.register(transferMovementRoutes);
  await app.register(adjustMovementRoutes);
  await app.register(listMovementsRoutes);
}
