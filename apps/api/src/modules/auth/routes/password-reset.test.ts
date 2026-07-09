import { describe, it, expect, vi, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import passwordResetRoutes from "./password-reset.js";
import loginRoutes from "./login.js";

vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));

const { sendEmail } = await import("../lib/email.js");

describe("password reset", () => {
  afterEach(async () => {
    await truncateAll();
    vi.mocked(sendEmail).mockClear();
  });

  it("lets the user sign in with the new password after completing a reset, not the old one", async () => {
    const { auth } = await import("../../../lib/auth.js");
    const email = `reset-${Date.now()}@example.com`;
    const oldPassword = "the-old-password-123";
    const newPassword = "a-brand-new-password-456";
    await auth.api.signUpEmail({ body: { email, password: oldPassword, name: "Reset User" } });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [passwordResetRoutes, loginRoutes] });

    const requestResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/request",
      payload: { email },
    });
    expect(requestResponse.statusCode).toBe(202);

    const sentBody = vi.mocked(sendEmail).mock.calls[0]?.[1]?.body ?? "";
    // Better Auth embeds the token as a path segment
    // (/reset-password/<token>?callbackURL=...), not a query param.
    const token = /\/reset-password\/([^\s?&]+)/.exec(sentBody)?.[1];
    expect(token).toBeTruthy();

    const completeResponse = await app.inject({
      method: "POST",
      url: "/auth/password-reset/complete",
      payload: { token, newPassword },
    });
    expect(completeResponse.statusCode).toBe(204);

    const oldPasswordLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: oldPassword },
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: newPassword },
    });
    expect(newPasswordLogin.statusCode).toBe(200);
  });
});
