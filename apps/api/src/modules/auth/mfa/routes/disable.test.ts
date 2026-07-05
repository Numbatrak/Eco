import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import { authenticator } from "otplib";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import disableRoutes from "./disable.js";
import { encryptSecret } from "../../../../lib/encryption.js";
import { hashPassword } from "../../lib/password.js";
import { signAccessToken } from "../../lib/jwt.js";

vi.mock("../../lib/users.js", () => ({
  findUserById: vi.fn(),
  updateUser: vi.fn(async () => {}),
}));
vi.mock("../../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../lib/backup-codes-store.js", () => ({
  deleteUnusedBackupCodes: vi.fn(async () => {}),
}));

const { findUserById, updateUser } = await import("../../lib/users.js");

describe("POST /auth/2fa/disable", () => {
  it("rejects a wrong password even with a correct code, and succeeds with both correct", async () => {
    const userId = "55555555-5555-5555-5555-555555555555";
    const correctPassword = "the-real-password-123456";
    const passwordHash = await hashPassword(correctPassword);
    const secret = authenticator.generateSecret();
    const fakeUser = makeFakeUser({
      id: userId,
      passwordHash,
      totpSecretEncrypted: encryptSecret(secret),
      totpEnabledAt: new Date(),
    });
    vi.mocked(findUserById).mockResolvedValue(fakeUser);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [disableRoutes] });
    const accessToken = await signAccessToken({ sub: userId });
    const authHeader = { authorization: `Bearer ${accessToken}` };

    const wrongPasswordAttempt = await app.inject({
      method: "POST",
      url: "/auth/2fa/disable",
      headers: authHeader,
      payload: { password: "not-the-password", code: authenticator.generate(secret) },
    });
    expect(wrongPasswordAttempt.statusCode).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();

    const correctAttempt = await app.inject({
      method: "POST",
      url: "/auth/2fa/disable",
      headers: authHeader,
      payload: { password: correctPassword, code: authenticator.generate(secret) },
    });
    expect(correctAttempt.statusCode).toBe(204);
    expect(updateUser).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.objectContaining({ totpEnabledAt: null }),
    );
  });
});
