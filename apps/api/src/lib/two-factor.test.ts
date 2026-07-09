import { describe, it, expect, vi, afterEach } from "vitest";
import { authenticator } from "otplib";
import { truncateAll } from "../test/test-db.js";
import { signUpUser } from "../test/auth-helpers.js";

vi.mock("../modules/auth/lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));

const { sendEmail } = await import("../modules/auth/lib/email.js");

function totpSecretFromUri(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error("No secret in otpauth URI");
  return secret;
}

describe("two-factor authentication", () => {
  afterEach(async () => {
    await truncateAll();
    vi.mocked(sendEmail).mockClear();
  });

  it("TOTP works as a second factor at sign-in", async () => {
    const { auth } = await import("./auth.js");
    const user = await signUpUser();

    const enableResult = await auth.api.enableTwoFactor({
      headers: user.headers,
      body: { password: user.password },
    });
    const secret = totpSecretFromUri(enableResult.totpURI);

    // skipVerificationOnEnable defaults to false - the enrollment isn't
    // active (and user.twoFactorEnabled isn't set) until confirmed once.
    await auth.api.verifyTOTP({
      headers: user.headers,
      body: { code: authenticator.generate(secret) },
    });

    const signIn = await auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });
    const pendingBody = (await signIn.json()) as { twoFactorRedirect?: boolean; twoFactorMethods?: string[] };
    expect(pendingBody.twoFactorRedirect).toBe(true);
    expect(pendingBody.twoFactorMethods).toContain("totp");

    const pendingCookies = signIn.headers.getSetCookie();
    const pendingHeaders = new Headers({
      cookie: pendingCookies.map((c) => c.split(";")[0]).join("; "),
    });

    const verifyResult = await auth.api.verifyTOTP({
      headers: pendingHeaders,
      body: { code: authenticator.generate(secret) },
      asResponse: true,
    });
    expect(verifyResult.ok).toBe(true);
    const finalBody = (await verifyResult.json()) as { token?: string; user?: { id: string } };
    expect(finalBody.token).toBeTypeOf("string");
    expect(finalBody.user?.id).toBe(user.userId);
  });

  it("email OTP works as a second factor at sign-in", async () => {
    const { auth } = await import("./auth.js");
    const user = await signUpUser();
    const password = user.password;

    // Email OTP rides on top of an already-enabled 2FA account (it's a
    // secondary delivery channel, not an independently enrollable method) -
    // enable + confirm TOTP first to flip user.twoFactorEnabled on.
    const enableResult = await auth.api.enableTwoFactor({ headers: user.headers, body: { password } });
    const secret = totpSecretFromUri(enableResult.totpURI);
    await auth.api.verifyTOTP({ headers: user.headers, body: { code: authenticator.generate(secret) } });

    const signIn = await auth.api.signInEmail({
      body: { email: user.email, password },
      asResponse: true,
    });
    const pendingCookies = signIn.headers.getSetCookie();
    const pendingHeaders = new Headers({
      cookie: pendingCookies.map((c) => c.split(";")[0]).join("; "),
    });

    await auth.api.sendTwoFactorOTP({ headers: pendingHeaders });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sentBody = vi.mocked(sendEmail).mock.calls[0]?.[1]?.body ?? "";
    const code = /Your code is (\d+)/.exec(sentBody)?.[1];
    expect(code).toBeTruthy();

    const verifyResult = await auth.api.verifyTwoFactorOTP({
      headers: pendingHeaders,
      body: { code: code! },
      asResponse: true,
    });
    expect(verifyResult.ok).toBe(true);
    const finalBody = (await verifyResult.json()) as { token?: string; user?: { id: string } };
    expect(finalBody.token).toBeTypeOf("string");
    expect(finalBody.user?.id).toBe(user.userId);
  });
});
