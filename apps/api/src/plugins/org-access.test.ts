import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { eq } from "drizzle-orm";
import { organization } from "@platform/db";
import type { RedisClient } from "../lib/redis.js";
import { buildTestApp } from "../test/build-test-app.js";
import { truncateAll, getTestDb } from "../test/test-db.js";
import { signUpOwnerWithOrg } from "../test/auth-helpers.js";
import tenantSettingsRoutes from "../modules/sites/routes/tenant-settings.js";

async function getSiteSettings(cookie: string) {
  const redis = new RedisMock() as unknown as RedisClient;
  const app = await buildTestApp({ redis, routes: [tenantSettingsRoutes] });
  return app.inject({ method: "GET", url: "/org/site-settings", headers: { cookie } });
}

describe("org-access suspension enforcement", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("blocks a suspended tenant's members from every /org/* route, platform-wide", async () => {
    const owner = await signUpOwnerWithOrg();
    const cookie = owner.headers.get("cookie") ?? "";

    const before = await getSiteSettings(cookie);
    // No tenantSiteConfig row exists yet, so a healthy org 404s here - the
    // important thing is it's NOT the suspension 403, proving the request
    // reached past the org-access preHandler while active.
    expect(before.statusCode).toBe(404);

    const db = getTestDb();
    await db.update(organization).set({ status: "suspended" }).where(eq(organization.id, owner.orgId));

    const after = await getSiteSettings(cookie);
    expect(after.statusCode).toBe(403);
    expect(after.json()).toMatchObject({ error: "organization_suspended" });
  });
});
