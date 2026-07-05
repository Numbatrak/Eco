import type { FastifyInstance } from "fastify";
import listProductsRoutes from "./list.js";
import createProductRoutes from "./create.js";
import updateProductRoutes from "./update.js";
import deleteProductRoutes from "./delete.js";

export default async function productsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listProductsRoutes);
  await app.register(createProductRoutes);
  await app.register(updateProductRoutes);
  await app.register(deleteProductRoutes);
}
