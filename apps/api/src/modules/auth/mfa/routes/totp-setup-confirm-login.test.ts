import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import { authenticator } from "otplib";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import setupRoutes from "./setup.js";
import confirmRoutes from "./confirm.js";
import verifyRoutes from "./verify.js";
import loginRoutes from "../../routes/login.js";
import { hashPassword } from "../../lib/password.js";
import { signAccessToken } from "../../lib/jwt.js";
import type { UserRow } from "../../lib/users.js";

vi.mock("../../lib/users.js", () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("../../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../../lib/refresh-tokens.js", () => ({
  issueRefreshToken: vi.fn(async () => ({ token: "fake-refresh-token", jti: "fake-refresh-jti" })),
}));
vi.mock("../lib/backup-codes-store.js", () => ({
  insertBackupCodeHashes: vi.fn(async () => {}),
}));

const { findUserById, findUserByEmail, updateUser } = await import("../../lib/users.js");

describe("TOTP setup -> confirm -> login-with-TOTP", () => {
  it("enrolls TOTP and then requires + accepts it on the next login", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";
    const email = "totp-user@example.com";
    const plainPassword = "correct horse battery staple";
    const passwordHash = await hashPassword(plainPassword);

    let userState: UserRow = makeFakeUser({ id: userId, email, passwordHash });

    vi.mocked(findUserById).mockImplementation(async () => userState);
    vi.mocked(findUserByEmail).mockImplementation(async () => userState);
    vi.mocked(updateUser).mockImplementation(async (_db, _id, patch) => {
      userState = { ...userState, ...patch };
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({
      redis,
      routes: [setupRoutes, confirmRoutes, loginRoutes, verifyRoutes],
    });

    const accessToken = await signAccessToken({ sub: userId });
    const authHeader = { authorization: `Bearer ${accessToken}` };

    const setupResponse = await app.inject({
      method: "POST",
      url: "/auth/2fa/totp/setup",
      headers: authHeader,
    });
    expect(setupResponse.statusCode).toBe(200);
    const { secret, otpauthUrl } = setupResponse.json();
    expect(otpauthUrl).toContain("otpauth://");
    expect(userState.totpSecretEncrypted).toBeTruthy();
    expect(userState.totpEnabledAt).toBeNull();

    const confirmResponse = await app.inject({
      method: "POST",
      url: "/auth/2fa/totp/confirm",
      headers: authHeader,
      payload: { code: authenticator.generate(secret) },
    });
    expect(confirmResponse.statusCode).toBe(200);
    const { backupCodes } = confirmResponse.json();
    expect(backupCodes).toHaveLength(8);
    expect(userState.totpEnabledAt).not.toBeNull();
    expect(userState.preferred2faMethod).toBe("totp");

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: plainPassword },
    });
    expect(loginResponse.statusCode).toBe(200);
    const loginBody = loginResponse.json();
    expect(loginBody.status).toBe("mfa_required");
    expect(loginBody.method).toBe("totp");
    expect(loginBody.accessToken).toBeUndefined();
    expect(loginBody.refreshToken).toBeUndefined();

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken: loginBody.challengeToken, code: authenticator.generate(secret) },
    });
    expect(verifyResponse.statusCode).toBe(200);
    const verifyBody = verifyResponse.json();
    expect(verifyBody.accessToken).toBeTypeOf("string");
    expect(verifyBody.refreshToken).toBeUndefined();
    expect(verifyResponse.cookies.find((c) => c.name === "refresh_token")?.value).toBe(
      "fake-refresh-token",
    );
  });
});
