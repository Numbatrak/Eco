import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}

export function hashBackupCode(code: string): Promise<string> {
  return argon2.hash(code, { type: argon2.argon2id });
}

export function verifyBackupCode(hash: string, code: string): Promise<boolean> {
  return argon2.verify(hash, code);
}
