import type { FastifyInstance } from "fastify";
import listOrdersRoutes from "./list.js";
import createOrderRoutes from "./create.js";
import updateOrderRoutes from "./update.js";
import advanceOrderStatusRoutes from "./advance-status.js";
import markOrderFailedRoutes from "./mark-failed.js";
import addOrderUpsellRoutes from "./add-upsell.js";
import deleteOrderRoutes from "./delete.js";

export default async function numbatrakOrdersRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listOrdersRoutes);
  await app.register(createOrderRoutes);
  await app.register(updateOrderRoutes);
  await app.register(advanceOrderStatusRoutes);
  await app.register(markOrderFailedRoutes);
  await app.register(addOrderUpsellRoutes);
  await app.register(deleteOrderRoutes);
}
