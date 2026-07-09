import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { signUpOwnerWithOrg } from "../../../test/auth-helpers.js";
import meRoutes from "./me.js";

describe("GET /auth/me", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("returns the current user and their organization memberships", async () => {
    const owner = await signUpOwnerWithOrg({ orgName: "Acme" });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [meRoutes] });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: owner.headers.get("cookie") ?? "" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.id).toBe(owner.userId);
    expect(body.user.email).toBe(owner.email);
    expect(body.organizations).toEqual([
      { id: owner.orgId, name: "Acme", slug: owner.slug, role: "owner" },
    ]);
    expect(body.activeOrganizationId).toBe(owner.orgId);
  });

  it("rejects a request without a session cookie", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [meRoutes] });

    const response = await app.inject({ method: "GET", url: "/auth/me" });

    expect(response.statusCode).toBe(401);
  });
});
