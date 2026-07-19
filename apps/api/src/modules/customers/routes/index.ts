import type { FastifyInstance } from "fastify";
import listCustomersRoutes from "./list.js";
import getCustomerRoutes from "./get.js";

export default async function customersRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listCustomersRoutes);
  await app.register(getCustomerRoutes);
}
