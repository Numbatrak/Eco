import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { platformAdminAuditLog } from "@platform/db";
import { eq } from "drizzle-orm";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { getTestDb, truncateAll } from "../../../test/test-db.js";
import { signUpPlatformAdmin } from "../../../test/platform-admin-auth-helpers.js";
import platformAdminLoginRoutes from "./login.js";

describe("POST /platform-admin/login rate limiting", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("locks out after 3 attempts within the window, regardless of credentials", async () => {
    const admin = await signUpPlatformAdmin();
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [platformAdminLoginRoutes] });

    for (let i = 0; i < 3; i++) {
      const response = await app.inject({
        method: "POST",
        url: "/platform-admin/login",
        payload: { email: admin.email, password: "wrong-password" },
      });
      expect(response.statusCode).toBe(401);
    }

    const fourth = await app.inject({
      method: "POST",
      url: "/platform-admin/login",
      payload: { email: admin.email, password: admin.password },
    });
    expect(fourth.statusCode).toBe(429);
  });
});

describe("POST /platform-admin/login audit logging", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("logs login_failed on wrong password", async () => {
    const admin = await signUpPlatformAdmin({ password: "correct-admin-pass-1234" });
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [platformAdminLoginRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/platform-admin/login",
      payload: { email: admin.email, password: "wrong-password-9999" },
      remoteAddress: "10.0.0.50",
    });

    expect(response.statusCode).toBe(401);

    const db = getTestDb();
    const events = await db
      .select()
      .from(platformAdminAuditLog)
      .where(eq(platformAdminAuditLog.action, "login_failed"));
    expect(events.length).toBeGreaterThanOrEqual(1);
    const details = events[0]?.details as { email?: string } | null;
    expect(details?.email).toBe(admin.email);
  });

  it("logs login_success on valid credentials", async () => {
    const password = "strong-admin-password-123";
    const admin = await signUpPlatformAdmin({ password });
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [platformAdminLoginRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/platform-admin/login",
      payload: { email: admin.email, password },
      remoteAddress: "10.0.0.99",
    });

    expect(response.statusCode).toBe(200);

    const db = getTestDb();
    const events = await db
      .select()
      .from(platformAdminAuditLog)
      .where(eq(platformAdminAuditLog.action, "login_success"));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
