import type { FastifyInstance } from "fastify";
import listNumbatrakProductsRoutes from "./list.js";

export default async function numbatrakProductsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listNumbatrakProductsRoutes);
}
