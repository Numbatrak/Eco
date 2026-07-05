import { timingSafeEqual } from "node:crypto";
import { authenticator } from "otplib";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpauthUri(secret: string, email: string): string {
  return authenticator.keyuri(email, "Platform", secret);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Fast path: constant-time compare against the exact current-step code.
 * Falls back to otplib's drift-tolerant window check for clock skew between
 * server and authenticator app - rate-limited upstream (5 attempts per
 * challenge), so the fallback isn't a meaningful timing oracle.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const expected = authenticator.generate(secret);
  if (constantTimeEqual(expected, code)) {
    return true;
  }
  return authenticator.check(code, secret);
}
