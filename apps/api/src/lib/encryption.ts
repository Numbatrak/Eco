import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

let _key: Buffer | undefined;

function getKey(): Buffer {
  if (!_key) {
    const raw = process.env.SECRET_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error(
        "SECRET_ENCRYPTION_KEY is not set. Copy .env.example to .env and configure it.",
      );
    }
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error("SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).");
    }
    _key = key;
  }
  return _key;
}

/**
 * Shared AES-256-GCM at-rest encryption for any short secret string (TOTP
 * seeds, payment provider secret keys, ...) - one key, one implementation.
 * Stored form: `iv:authTag:ciphertext`, each base64url.
 */
export function encryptSecret(secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64url")).join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret");
  }
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart as string, "base64url");
  const authTag = Buffer.from(authTagPart as string, "base64url");
  const ciphertext = Buffer.from(ciphertextPart as string, "base64url");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
