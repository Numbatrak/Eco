import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { makeFakeUser } from "../../../test/fixtures.js";
import passwordResetRoutes from "./password-reset.js";
import refreshRoutes from "./refresh.js";
import { signRefreshToken } from "../lib/jwt.js";

vi.mock("../lib/users.js", () => ({
  findUserByEmail: vi.fn(),
  updateUser: vi.fn(async () => {}),
}));
vi.mock("../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));

let sessionsRevoked = false;

vi.mock("../lib/refresh-tokens.js", () => ({
  revokeAllRefreshTokens: vi.fn(async () => {
    sessionsRevoked = true;
  }),
  findActiveRefreshTokenRow: vi.fn(async () =>
    sessionsRevoked ? null : { id: "row-1", userId: "66666666-6666-6666-6666-666666666666" },
  ),
  issueRefreshToken: vi.fn(async () => ({ token: "new-refresh-token", jti: "new-jti" })),
  revokeRefreshTokenRow: vi.fn(async () => {}),
}));

const { findUserByEmail } = await import("../lib/users.js");
const { sendEmail } = await import("../lib/email.js");

describe("password reset revokes existing sessions", () => {
  it("a previously-valid refresh token stops working after the reset completes", async () => {
    const userId = "66666666-6666-6666-6666-666666666666";
    const email = "reset-user@example.com";
    const fakeUser = makeFakeUser({ id: userId, email });
    vi.mocked(findUserByEmail).mockResolvedValue(fakeUser);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [passwordResetRoutes, refreshRoutes] });

    const oldRefreshToken = await signRefreshToken({ sub: userId, jti: "old-session-jti" });

    // Sanity check: the old refresh token works before the reset.
    const beforeReset = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: oldRefreshToken },
    });
    expect(beforeReset.statusCode).toBe(200);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/request",
      payload: { email },
    });
    expect(requestResponse.statusCode).toBe(202);

    const sentBody = vi.mocked(sendEmail).mock.calls[0]?.[1]?.body ?? "";
    const token = /password: (\S+)/.exec(sentBody)?.[1];
    expect(token).toBeTruthy();

    const completeResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/complete",
      payload: { token, newPassword: "a-brand-new-password-123" },
    });
    expect(completeResponse.statusCode).toBe(204);

    const afterReset = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: oldRefreshToken },
    });
    expect(afterReset.statusCode).toBe(401);
  });
});
