import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import emailOtpSetupRoutes from "./email-otp-setup.js";
import emailOtpConfirmRoutes from "./email-otp-confirm.js";
import { signAccessToken } from "../../lib/jwt.js";
import type { UserRow } from "../../lib/users.js";

vi.mock("../../lib/users.js", () => ({
  findUserById: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("../../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../../lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));

const { findUserById, updateUser } = await import("../../lib/users.js");
const { sendEmail } = await import("../../lib/email.js");

describe("email OTP enrollment", () => {
  it("setup emails a code, confirm with the right code enables email OTP", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";
    let userState: UserRow = makeFakeUser({ id: userId });

    vi.mocked(findUserById).mockImplementation(async () => userState);
    vi.mocked(updateUser).mockImplementation(async (_db, _id, patch) => {
      userState = { ...userState, ...patch };
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [emailOtpSetupRoutes, emailOtpConfirmRoutes] });
    const authHeader = { authorization: `Bearer ${await signAccessToken({ sub: userId })}` };

    const setupResponse = await app.inject({
      method: "POST",
      url: "/auth/2fa/email-otp/setup",
      headers: authHeader,
    });
    expect(setupResponse.statusCode).toBe(202);

    const sentBody = vi.mocked(sendEmail).mock.calls[0]?.[1]?.body ?? "";
    const code = /verification code is (\d{6})/.exec(sentBody)?.[1];
    expect(code).toBeTruthy();

    const wrongCode = await app.inject({
      method: "POST",
      url: "/auth/2fa/email-otp/confirm",
      headers: authHeader,
      payload: { code: "000000" },
    });
    expect(wrongCode.statusCode).toBe(401);
    expect(userState.emailOtpEnabledAt).toBeNull();

    const confirmResponse = await app.inject({
      method: "POST",
      url: "/auth/2fa/email-otp/confirm",
      headers: authHeader,
      payload: { code },
    });
    expect(confirmResponse.statusCode).toBe(204);
    expect(userState.emailOtpEnabledAt).not.toBeNull();
    expect(userState.preferred2faMethod).toBe("email_otp");
  });
});
