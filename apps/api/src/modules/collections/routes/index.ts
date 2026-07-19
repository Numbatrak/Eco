import type { FastifyInstance } from "fastify";
import listCollectionsRoutes from "./list.js";
import getCollectionRoutes from "./get.js";
import createCollectionRoutes from "./create.js";
import updateCollectionRoutes from "./update.js";
import deleteCollectionRoutes from "./delete.js";

export default async function collectionsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listCollectionsRoutes);
  await app.register(getCollectionRoutes);
  await app.register(createCollectionRoutes);
  await app.register(updateCollectionRoutes);
  await app.register(deleteCollectionRoutes);
}
