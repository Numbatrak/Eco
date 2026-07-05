import type { RedisClient } from "../../../../lib/redis.js";

function enrollmentKey(userId: string): string {
  return `mfa:email_otp_enroll:${userId}`;
}

export async function storeEmailOtpEnrollmentCode(
  redis: RedisClient,
  userId: string,
  codeHash: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(enrollmentKey(userId), codeHash, "EX", ttlSeconds);
}

export async function getEmailOtpEnrollmentHash(
  redis: RedisClient,
  userId: string,
): Promise<string | null> {
  return redis.get(enrollmentKey(userId));
}

export async function clearEmailOtpEnrollmentCode(redis: RedisClient, userId: string): Promise<void> {
  await redis.del(enrollmentKey(userId));
}
