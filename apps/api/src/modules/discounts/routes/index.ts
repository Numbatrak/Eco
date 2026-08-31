import type { FastifyInstance } from "fastify";
import discountsCrudRoutes from "./crud.js";
import discountValidateRoutes from "./validate.js";

export default async function discountsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(discountsCrudRoutes);
  await app.register(discountValidateRoutes);
}
