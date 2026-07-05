import type { Database } from "@platform/db";
import { findUserById } from "../../auth/lib/users.js";
import { verifyPassword } from "../../auth/lib/password.js";
import { verifyCurrentMfaCode } from "../../auth/mfa/lib/verify-code.js";

export type LiveModeReauthResult = { ok: true } | { ok: false; status: 400 | 401; error: string };

/**
 * Re-auth bar for saving live-mode payment credentials - the same bar as
 * disabling 2FA (password always; a current 2FA code too, if the user has
 * one enrolled). Unlike disable-2FA, this endpoint isn't gated on the user
 * already having 2FA - a merchant without it enrolled only needs their
 * password, rather than being permanently locked out of live mode.
 */
export async function verifyLiveModeReauth(
  db: Database,
  userId: string,
  password: string | undefined,
  code: string | undefined,
): Promise<LiveModeReauthResult> {
  if (!password) {
    return { ok: false, status: 400, error: "Password is required to save live-mode credentials" };
  }
  const user = await findUserById(db, userId);
  if (!user) {
    return { ok: false, status: 401, error: "Unknown user" };
  }
  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) {
    return { ok: false, status: 401, error: "Incorrect password" };
  }
  if (user.totpEnabledAt) {
    if (!code) {
      return {
        ok: false,
        status: 400,
        error: "A current 2FA code is required to save live-mode credentials",
      };
    }
    const codeResult = await verifyCurrentMfaCode(db, user, code);
    if (!codeResult.ok) {
      return { ok: false, status: 401, error: "Invalid 2FA code" };
    }
  }
  return { ok: true };
}
