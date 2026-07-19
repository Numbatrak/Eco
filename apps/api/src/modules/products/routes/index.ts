import type { FastifyInstance } from "fastify";
import listProductsRoutes from "./list.js";
import getProductRoutes from "./get.js";
import createProductRoutes from "./create.js";
import updateProductRoutes from "./update.js";
import deleteProductRoutes from "./delete.js";
import listVariantsRoutes from "./variants/list.js";
import createVariantRoutes from "./variants/create.js";
import updateVariantRoutes from "./variants/update.js";
import deleteVariantRoutes from "./variants/delete.js";

export default async function productsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listProductsRoutes);
  await app.register(getProductRoutes);
  await app.register(createProductRoutes);
  await app.register(updateProductRoutes);
  await app.register(deleteProductRoutes);
  await app.register(listVariantsRoutes);
  await app.register(createVariantRoutes);
  await app.register(updateVariantRoutes);
  await app.register(deleteVariantRoutes);
}
