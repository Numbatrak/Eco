import type { RedisClient } from "../../../lib/redis.js";

function usedJtiKey(jti: string): string {
  return `mfa:used_jti:${jti}`;
}

function emailOtpKey(jti: string): string {
  return `mfa:email_otp:${jti}`;
}

/** Marks a challenge jti as spent. Returns false if it was already spent (replay). */
export async function markChallengeJtiUsed(
  redis: RedisClient,
  jti: string,
  ttlSeconds: number,
): Promise<boolean> {
  const result = await redis.set(usedJtiKey(jti), "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}

export async function isChallengeJtiUsed(redis: RedisClient, jti: string): Promise<boolean> {
  const value = await redis.get(usedJtiKey(jti));
  return value !== null;
}

/** Immediately invalidates a challenge (e.g. after exceeding max attempts). */
export async function invalidateChallenge(
  redis: RedisClient,
  jti: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(usedJtiKey(jti), "1", "EX", ttlSeconds);
}

export async function storeEmailOtp(
  redis: RedisClient,
  jti: string,
  codeHash: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(emailOtpKey(jti), codeHash, "EX", ttlSeconds);
}

export async function getEmailOtpHash(redis: RedisClient, jti: string): Promise<string | null> {
  return redis.get(emailOtpKey(jti));
}

export async function clearEmailOtp(redis: RedisClient, jti: string): Promise<void> {
  await redis.del(emailOtpKey(jti));
}
