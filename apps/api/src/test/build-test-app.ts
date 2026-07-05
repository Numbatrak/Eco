import Fastify, { type FastifyInstance } from "fastify";
import type { Database } from "@platform/db";
import type { RedisClient } from "../lib/redis.js";
import authenticatePlugin from "../plugins/authenticate.js";
import cookiesPlugin from "../plugins/cookies.js";
import tenantAccessPlugin from "../plugins/tenant-access.js";

export interface TestAppDeps {
  db?: Database;
  redis: RedisClient;
  routes: Array<(app: FastifyInstance) => Promise<void>>;
}

/**
 * Builds a Fastify instance for tests without touching the real
 * getDb()/getRedis() singletons - decorates them directly so route handlers
 * see the same `app.getDb()`/`app.getRedis()` seam they use in production.
 */
export async function buildTestApp(deps: TestAppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const db = deps.db ?? ({} as Database);
  app.decorate("getDb", () => db);
  app.decorate("getRedis", () => deps.redis);
  await app.register(cookiesPlugin);
  await app.register(authenticatePlugin);
  await app.register(tenantAccessPlugin);
  for (const route of deps.routes) {
    await app.register(route);
  }
  await app.ready();
  return app;
}
