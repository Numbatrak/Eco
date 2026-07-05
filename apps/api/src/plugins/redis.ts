import fp from "fastify-plugin";
import { getRedis, type RedisClient } from "../lib/redis.js";

declare module "fastify" {
  interface FastifyInstance {
    getRedis: () => RedisClient;
  }
}

export default fp(async (app) => {
  app.decorate("getRedis", getRedis);
});
