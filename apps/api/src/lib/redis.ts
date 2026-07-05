import { Redis } from "ioredis";

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set. Copy .env.example to .env and configure it.");
    }
    _redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }
  return _redis;
}

export type RedisClient = Redis;
