import { platformAdminAuth } from "../lib/platform-admin-auth.js";

export interface SignedUpPlatformAdmin {
  adminId: string;
  email: string;
  password: string;
  headers: Headers;
}

function cookieHeadersFrom(setCookies: string[]): Headers {
  return new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; ") });
}

/**
 * Signs up a platform-admin account directly via platformAdminAuth.api (the
 * same call path the CLI script uses) - never through the HTTP bridge,
 * which blocks the public sign-up endpoint by design.
 */
export async function signUpPlatformAdmin(
  overrides: { email?: string; password?: string; name?: string } = {},
): Promise<SignedUpPlatformAdmin> {
  const email = overrides.email ?? `admin-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? "a-strong-admin-password-123";
  const name = overrides.name ?? "Test Admin";

  const result = await platformAdminAuth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });
  const headers = cookieHeadersFrom(result.headers.getSetCookie());
  const payload = (await result.json()) as { user: { id: string } };
  return { adminId: payload.user.id, email, password, headers };
}
