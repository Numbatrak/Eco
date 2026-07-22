import type { FastifyInstance } from "fastify";
import listFollowUpsRoutes from "./list.js";
import countFollowUpsRoutes from "./count.js";
import createFollowUpRoutes from "./create.js";
import updateFollowUpRoutes from "./update.js";
import deleteFollowUpRoutes from "./delete.js";
import resolveForCartRoutes from "./resolve-for-cart.js";

export default async function numbatrakFollowUpsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listFollowUpsRoutes);
  await app.register(countFollowUpsRoutes);
  await app.register(createFollowUpRoutes);
  await app.register(updateFollowUpRoutes);
  await app.register(deleteFollowUpRoutes);
  await app.register(resolveForCartRoutes);
}
