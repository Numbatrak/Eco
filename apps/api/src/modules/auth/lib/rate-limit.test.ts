import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { checkAndIncrementRateLimit, checkRateLimitOrAllow } from "./rate-limit.js";

const opts = { limit: 2, windowSeconds: 60 };

describe("checkRateLimitOrAllow", () => {
  it("counts and limits normally while Redis is up", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const log = { warn: vi.fn() };
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await checkRateLimitOrAllow(() => redis, "k:up", opts, log));
    expect(results.map((r) => r.allowed)).toEqual([true, true, false]);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("lets the order through when Redis is unreachable", async () => {
    const down = { incr: vi.fn().mockRejectedValue(new Error("Reached the max retries per request limit")) };
    const log = { warn: vi.fn() };
    const result = await checkRateLimitOrAllow(() => down as unknown as RedisClient, "k:down", opts, log);
    expect(result.allowed).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("lets the order through when Redis isn't configured at all", async () => {
    const log = { warn: vi.fn() };
    const result = await checkRateLimitOrAllow(
      () => {
        throw new Error("REDIS_URL is not set");
      },
      "k:none",
      opts,
      log,
    );
    expect(result.allowed).toBe(true);
  });
});

describe("checkAndIncrementRateLimit (login and other credential routes)", () => {
  it("still throws when Redis is unreachable, so those routes fail closed", async () => {
    const down = { incr: vi.fn().mockRejectedValue(new Error("down")) };
    await expect(checkAndIncrementRateLimit(down as unknown as RedisClient, "k", opts)).rejects.toThrow("down");
  });
});
