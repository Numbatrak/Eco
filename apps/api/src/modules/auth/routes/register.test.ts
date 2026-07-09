import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { member } from "@platform/db";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { getTestDb, truncateAll } from "../../../test/test-db.js";
import registerRoutes from "./register.js";

describe("POST /auth/register", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("creates a user + organization with an owner-role membership", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [registerRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: `new-${Date.now()}@example.com`,
        password: "a-strong-password-123",
        businessName: "Acme",
      },
    });

    expect(response.statusCode).toBe(202);

    const db = getTestDb();
    const rows = await db.select().from(member);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("owner");
  });

  it("returns the identical response for a duplicate email without creating a second membership", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [registerRoutes] });
    const email = `taken-${Date.now()}@example.com`;

    const first = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "a-strong-password-123", businessName: "Acme" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "a-different-password-456", businessName: "Someone Else" },
    });

    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());

    const db = getTestDb();
    const rows = await db.select().from(member);
    expect(rows).toHaveLength(1);
  });
});
