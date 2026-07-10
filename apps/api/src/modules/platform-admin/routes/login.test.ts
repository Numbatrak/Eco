import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
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
