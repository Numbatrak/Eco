import { randomInt } from "node:crypto";
import * as argon2 from "argon2";

export function generateEmailOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashEmailOtp(code: string): Promise<string> {
  return argon2.hash(code, { type: argon2.argon2id });
}

export function verifyEmailOtp(hash: string, code: string): Promise<boolean> {
  return argon2.verify(hash, code);
}
