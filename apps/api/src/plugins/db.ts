import fp from "fastify-plugin";
import { getDb, type Database } from "@platform/db";

declare module "fastify" {
  interface FastifyInstance {
    getDb: () => Database;
  }
}

/**
 * Exposes a lazy db accessor on the Fastify instance so the app can boot
 * without DATABASE_URL until a route actually calls `app.getDb()`.
 * The auth task builds on top of this seam.
 */
export default fp(async (app) => {
  app.decorate("getDb", getDb);
});
