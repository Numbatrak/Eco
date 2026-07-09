import Fastify, { type FastifyInstance } from "fastify";
import { getDb, type Database } from "@platform/db";
import type { RedisClient } from "../lib/redis.js";
import cookiesPlugin from "../plugins/cookies.js";
import betterAuthPlugin from "../plugins/better-auth.js";
import orgAccessPlugin from "../plugins/org-access.js";

export interface TestAppDeps {
  db?: Database;
  redis: RedisClient;
  routes: Array<(app: FastifyInstance) => Promise<void>>;
}

/**
 * Builds a Fastify instance for tests. Unlike the pre-migration version,
 * this always registers the real betterAuthPlugin/orgAccessPlugin - Better
 * Auth's own api.* calls always go through the real getDb() singleton
 * (pointed at TEST_DATABASE_URL by test/setup.ts), so there's no meaningful
 * "fully mocked, no DB" mode left for routes gated by requireOrgPermission/
 * requireOrgMembership. Tests that don't need a real session/org (e.g.
 * asserting register.ts's duplicate-email 202 shape) mock ../../lib/auth.js
 * directly instead of faking app.getDb().
 */
export async function buildTestApp(deps: TestAppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const db = deps.db ?? getDb();
  app.decorate("getDb", () => db);
  app.decorate("getRedis", () => deps.redis);
  await app.register(cookiesPlugin);
  await app.register(betterAuthPlugin);
  await app.register(orgAccessPlugin);
  for (const route of deps.routes) {
    await app.register(route);
  }
  await app.ready();
  return app;
}
