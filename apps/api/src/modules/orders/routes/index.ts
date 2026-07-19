import type { FastifyInstance } from "fastify";
import listOrdersRoutes from "./list.js";
import orderDetailRoutes from "./detail.js";

import updateOrderStatusRoutes from "./update-status.js";

export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listOrdersRoutes);
  await app.register(orderDetailRoutes);
  await app.register(updateOrderStatusRoutes);
}
