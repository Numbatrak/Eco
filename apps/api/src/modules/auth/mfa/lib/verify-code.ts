import type { Database } from "@platform/db";
import type { RedisClient } from "../../../../lib/redis.js";
import { decryptTotpSecret } from "../../lib/totp-encryption.js";
import { getEmailOtpHash, clearEmailOtp } from "../../lib/mfa-challenge-store.js";
import { verifyTotpCode } from "./totp.js";
import { verifyEmailOtp } from "./email-otp.js";
import { verifyBackupCode } from "./backup-codes.js";
import { listUnusedBackupCodes, markBackupCodeUsed } from "./backup-codes-store.js";

export type MfaVerificationMethod = "totp" | "email_otp" | "backup_code";

export interface MfaUserRow {
  id: string;
  totpSecretEncrypted: string | null;
  totpEnabledAt: Date | null;
  emailOtpEnabledAt: Date | null;
}

async function tryBackupCode(db: Database, userId: string, code: string): Promise<boolean> {
  const unused = await listUnusedBackupCodes(db, userId);

  for (const row of unused) {
    if (await verifyBackupCode(row.codeHash, code)) {
      await markBackupCodeUsed(db, row.id);
      return true;
    }
  }
  return false;
}

/**
 * Full verification used during the login 2FA challenge: tries TOTP, then
 * email OTP (looked up by the challenge's jti in Redis), then backup codes.
 */
export async function verifyChallengeCode(
  db: Database,
  redis: RedisClient,
  user: MfaUserRow,
  jti: string,
  code: string,
): Promise<{ ok: boolean; via?: MfaVerificationMethod }> {
  if (user.totpEnabledAt && user.totpSecretEncrypted) {
    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (verifyTotpCode(secret, code)) {
      return { ok: true, via: "totp" };
    }
  }

  if (user.emailOtpEnabledAt) {
    const hash = await getEmailOtpHash(redis, jti);
    if (hash && (await verifyEmailOtp(hash, code))) {
      await clearEmailOtp(redis, jti);
      return { ok: true, via: "email_otp" };
    }
  }

  if (await tryBackupCode(db, user.id, code)) {
    return { ok: true, via: "backup_code" };
  }

  return { ok: false };
}

/**
 * Verification used for re-auth on already-authenticated actions (disable,
 * backup code regeneration): TOTP or backup code only - there's no active
 * login challenge to have sent an email OTP against.
 */
export async function verifyCurrentMfaCode(
  db: Database,
  user: MfaUserRow,
  code: string,
): Promise<{ ok: boolean; via?: MfaVerificationMethod }> {
  if (user.totpEnabledAt && user.totpSecretEncrypted) {
    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (verifyTotpCode(secret, code)) {
      return { ok: true, via: "totp" };
    }
  }

  if (await tryBackupCode(db, user.id, code)) {
    return { ok: true, via: "backup_code" };
  }

  return { ok: false };
}
