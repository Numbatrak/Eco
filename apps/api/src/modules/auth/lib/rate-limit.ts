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

/**
 * Rate limit for public routes that take real customer orders (form intake,
 * storefront checkout): if Redis can't be reached - not configured, down,
 * deleted - the request is ALLOWED through and a warning logged. Losing a
 * paying customer's order is worse than briefly having no rate limit.
 *
 * Not for login or anything guarding credentials: there the limit is the
 * protection, so keep using checkAndIncrementRateLimit, which throws.
 */
export async function checkRateLimitOrAllow(
  getRedis: () => RedisClient,
  key: string,
  opts: { limit: number; windowSeconds: number },
  log: { warn: (obj: object, msg: string) => void },
): Promise<RateLimitResult> {
  try {
    return await checkAndIncrementRateLimit(getRedis(), key, opts);
  } catch (err) {
    log.warn({ err, key }, "Rate limiter unavailable (Redis unreachable) - allowing request through");
    return { allowed: true, remaining: opts.limit };
  }
}
