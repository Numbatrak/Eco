import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { eq } from "drizzle-orm";
import { organization, tenantSiteConfig } from "@platform/db";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll, getTestDb } from "../../../test/test-db.js";
import { signUpOwnerWithOrg } from "../../../test/auth-helpers.js";
import resolveSiteRoutes from "./resolve.js";

describe("GET /public/sites/:subdomain suspension state", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("returns the distinct site_suspended state for a suspended tenant, not the site_not_found 404", async () => {
    const owner = await signUpOwnerWithOrg();
    const db = getTestDb();
    await db.insert(tenantSiteConfig).values({
      tenantId: owner.orgId,
      publishedAt: new Date(),
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [resolveSiteRoutes] });

    const before = await app.inject({ method: "GET", url: `/public/sites/${owner.slug}` });
    expect(before.statusCode).toBe(200);

    await db.update(organization).set({ status: "suspended" }).where(eq(organization.id, owner.orgId));

    const after = await app.inject({ method: "GET", url: `/public/sites/${owner.slug}` });
    expect(after.statusCode).toBe(403);
    expect(after.json()).toMatchObject({ error: "site_suspended" });

    const missing = await app.inject({ method: "GET", url: "/public/sites/no-such-subdomain" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: "site_not_found" });
  });

  it("falls back to defaultSiteConfig for a legacy row missing typed theme/sections", async () => {
    const owner = await signUpOwnerWithOrg();
    const db = getTestDb();
    
    // Insert a legacy row with no theme or sections
    await db.insert(tenantSiteConfig).values({
      tenantId: owner.orgId,
      publishedAt: new Date(),
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [resolveSiteRoutes] });

    const response = await app.inject({ method: "GET", url: `/public/sites/${owner.slug}` });
    expect(response.statusCode).toBe(200);
    
    const body = response.json();
    // Check that it applied defaultSiteConfig("market")
    expect(body.theme).toBeDefined();
    expect(body.theme.templateId).toBe("market");
    expect(body.sections).toBeInstanceOf(Array);
    expect(body.sections.length).toBeGreaterThan(0);
    expect(body.sections[0].kind).toBe("hero");
  });
});
