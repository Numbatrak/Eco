import type { RedisClient } from "../../../lib/redis.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-window counter via Redis INCR + EXPIRE NX, so the TTL is only set on
 * the first increment in a window - correct across process restarts/replicas,
 * unlike an in-memory counter.
 */
export async function checkAndIncrementRateLimit(
  redis: RedisClient,
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, opts.windowSeconds);
  }
  return { allowed: count <= opts.limit, remaining: Math.max(0, opts.limit - count) };
}
