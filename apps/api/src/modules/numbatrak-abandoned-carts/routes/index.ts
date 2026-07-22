import type { FastifyInstance } from "fastify";
import listAbandonedCartsRoutes from "./list.js";
import countAbandonedCartsRoutes from "./count.js";
import abandonedCartFunnelsRoutes from "./funnels.js";
import createAbandonedCartRoutes from "./create.js";
import updateAbandonedCartRoutes from "./update.js";
import deleteAbandonedCartRoutes from "./delete.js";
import convertAbandonedCartRoutes from "./convert.js";

export default async function numbatrakAbandonedCartsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listAbandonedCartsRoutes);
  await app.register(countAbandonedCartsRoutes);
  await app.register(abandonedCartFunnelsRoutes);
  await app.register(createAbandonedCartRoutes);
  await app.register(updateAbandonedCartRoutes);
  await app.register(deleteAbandonedCartRoutes);
  await app.register(convertAbandonedCartRoutes);
}
