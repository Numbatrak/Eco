import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import { authenticator } from "otplib";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import verifyRoutes from "./verify.js";
import { encryptTotpSecret } from "../../lib/totp-encryption.js";
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

describe("2FA challenge attempt lockout", () => {
  const secret = authenticator.generateSecret();
  const userId = "22222222-2222-2222-2222-222222222222";
  const fakeUser = makeFakeUser({
    id: userId,
    totpSecretEncrypted: encryptTotpSecret(secret),
    totpEnabledAt: new Date(),
  });

  beforeEach(() => {
    vi.mocked(findUserById).mockResolvedValue(fakeUser);
  });

  it("invalidates the challenge after 5 failed attempts, rejecting even the correct code afterward", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyRoutes] });

    const challengeToken = await signMfaChallengeToken({ sub: userId, jti: "lockout-jti" });

    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: "POST",
        url: "/auth/2fa/verify",
        payload: { challengeToken, code: "000000" },
      });
      expect(response.statusCode).toBe(401);
    }

    const correctCode = authenticator.generate(secret);
    const finalAttempt = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken, code: correctCode },
    });
    expect(finalAttempt.statusCode).toBe(429);
  });
});
