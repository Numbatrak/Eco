import type { FastifyInstance } from "fastify";
import listNumbatrakProductsRoutes from "./list.js";
import listNumbatrakProductDetailsRoutes from "./list-details.js";
import createNumbatrakProductRoutes from "./create.js";
import updateNumbatrakProductRoutes from "./update.js";
import deleteNumbatrakProductRoutes from "./delete.js";
import numbatrakProductVariantRoutes from "./variants.js";
import numbatrakProductOfferRoutes from "./offers.js";
import numbatrakReceiveStockRoutes from "./receive-stock.js";

export default async function numbatrakProductsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listNumbatrakProductsRoutes);
  await app.register(listNumbatrakProductDetailsRoutes);
  await app.register(createNumbatrakProductRoutes);
  await app.register(updateNumbatrakProductRoutes);
  await app.register(deleteNumbatrakProductRoutes);
  await app.register(numbatrakProductVariantRoutes);
  await app.register(numbatrakProductOfferRoutes);
  await app.register(numbatrakReceiveStockRoutes);
}
