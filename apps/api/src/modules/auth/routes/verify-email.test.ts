import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import verifyEmailRoutes from "./verify-email.js";
import { sha256Hex } from "../lib/tokens.js";

vi.mock("../lib/users.js", () => ({
  updateUser: vi.fn(async () => {}),
}));

const { updateUser } = await import("../lib/users.js");

describe("POST /auth/verify-email", () => {
  it("marks the user verified for a valid token and consumes it (single use)", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyEmailRoutes] });

    const token = "a-real-verification-token";
    await redis.set(`emailverify:${sha256Hex(token)}`, "user-1", "EX", 3600);

    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { token },
    });

    expect(response.statusCode).toBe(204);
    expect(updateUser).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
    );

    const replay = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { token },
    });
    expect(replay.statusCode).toBe(400);
  });

  it("rejects an unknown or expired token", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyEmailRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { token: "not-a-real-token" },
    });

    expect(response.statusCode).toBe(400);
  });
});
