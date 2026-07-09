import { isAPIError } from "better-auth/api";
import { auth } from "../../../lib/auth.js";

export type LiveModeReauthResult = { ok: true } | { ok: false; status: 400 | 401; error: string };

/**
 * Re-auth bar for saving live-mode payment credentials - the same bar as
 * disabling 2FA (password always; a current 2FA code too, if the user has
 * one enrolled). Unlike disable-2FA, this endpoint isn't gated on the user
 * already having 2FA - a merchant without it enrolled only needs their
 * password, rather than being permanently locked out of live mode.
 *
 * Delegates to Better Auth's own verifyPassword/verifyTOTP/verifyBackupCode
 * endpoints (called against the caller's *current*, already-authenticated
 * session - these aren't sign-in-pending-only, they also accept a normal
 * session) rather than re-implementing password/TOTP verification.
 */
export async function verifyLiveModeReauth(
  headers: Headers,
  password: string | undefined,
  code: string | undefined,
): Promise<LiveModeReauthResult> {
  if (!password) {
    return { ok: false, status: 400, error: "Password is required to save live-mode credentials" };
  }

  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { ok: false, status: 401, error: "Unknown user" };
  }

  try {
    await auth.api.verifyPassword({ headers, body: { password } });
  } catch (error) {
    if (isAPIError(error)) {
      return { ok: false, status: 401, error: "Incorrect password" };
    }
    throw error;
  }

  const twoFactorEnabled = Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled);
  if (twoFactorEnabled) {
    if (!code) {
      return {
        ok: false,
        status: 400,
        error: "A current 2FA code is required to save live-mode credentials",
      };
    }
    const codeOk = await verifyCurrentTwoFactorCode(headers, code);
    if (!codeOk) {
      return { ok: false, status: 401, error: "Invalid 2FA code" };
    }
  }

  return { ok: true };
}

async function verifyCurrentTwoFactorCode(headers: Headers, code: string): Promise<boolean> {
  try {
    await auth.api.verifyTOTP({ headers, body: { code } });
    return true;
  } catch {
    // Fall through to backup code.
  }
  try {
    await auth.api.verifyBackupCode({ headers, body: { code } });
    return true;
  } catch {
    return false;
  }
}
