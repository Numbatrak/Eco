import type { FastifyInstance } from "fastify";
import listOrdersRoutes from "./list.js";
import orderDetailRoutes from "./detail.js";

export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listOrdersRoutes);
  await app.register(orderDetailRoutes);
}
