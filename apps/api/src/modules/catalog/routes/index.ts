import type { FastifyInstance } from "fastify";
import catalogFeedRoutes from "./feed.js";

export default async function catalogRoutes(app: FastifyInstance): Promise<void> {
  await app.register(catalogFeedRoutes);
}
