import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../modules/auth/lib/jwt.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export default fp(async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      await reply.code(401).send({ error: "Missing bearer token" });
      return;
    }
    try {
      const { sub } = await verifyAccessToken(token);
      request.userId = sub;
    } catch {
      await reply.code(401).send({ error: "Invalid or expired access token" });
    }
  });
});
