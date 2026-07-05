import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import { authenticator } from "otplib";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import verifyRoutes from "./verify.js";
import { encryptSecret } from "../../../../lib/encryption.js";
import { signMfaChallengeToken } from "../../lib/jwt.js";

vi.mock("../../lib/users.js", () => ({
  findUserById: vi.fn(),
}));
vi.mock("../../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../../lib/refresh-tokens.js", () => ({
  issueRefreshToken: vi.fn(async () => ({ token: "fake-refresh-token", jti: "fake-refresh-jti" })),
}));
vi.mock("../lib/backup-codes-store.js", () => ({
  listUnusedBackupCodes: vi.fn(async () => []),
  markBackupCodeUsed: vi.fn(async () => {}),
}));

const { findUserById } = await import("../../lib/users.js");

describe("POST /auth/2fa/verify", () => {
  const secret = authenticator.generateSecret();
  const userId = "11111111-1111-1111-1111-111111111111";
  const fakeUser = makeFakeUser({
    id: userId,
    totpSecretEncrypted: encryptSecret(secret),
    totpEnabledAt: new Date(),
  });

  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(fakeUser);
  });

  it("issues tokens for a correct TOTP code and rejects replay of the same challenge", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyRoutes] });

    const challengeJti = "challenge-jti-1";
    const challengeToken = await signMfaChallengeToken({ sub: userId, jti: challengeJti });
    const code = authenticator.generate(secret);

    const first = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken, code },
    });
    expect(first.statusCode).toBe(200);
    const body = first.json();
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeUndefined();
    expect(first.cookies.find((c) => c.name === "refresh_token")?.value).toBe("fake-refresh-token");

    const replay = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken, code },
    });
    expect(replay.statusCode).toBe(401);
  });

  it("rejects an incorrect code", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyRoutes] });

    const challengeToken = await signMfaChallengeToken({ sub: userId, jti: "challenge-jti-2" });

    const response = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken, code: "000000" },
    });
    expect(response.statusCode).toBe(401);
  });
});
