import type { FastifyInstance } from "fastify";
import { verifyEmailRequestSchema } from "@platform/shared-types";
import { sha256Hex } from "../lib/tokens.js";
import { updateUser } from "../lib/users.js";

function verifyTokenKey(hash: string): string {
  return `emailverify:${hash}`;
}

export default async function verifyEmailRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/verify-email", async (request, reply) => {
    const body = verifyEmailRequestSchema.parse(request.body);
    const redis = app.getRedis();
    const db = app.getDb();

    const key = verifyTokenKey(sha256Hex(body.token));
    const userId = await redis.get(key);
    if (!userId) {
      return reply.code(400).send({ error: "Invalid or expired verification token" });
    }
    await redis.del(key);

    await updateUser(db, userId, { emailVerifiedAt: new Date() });

    return reply.code(204).send();
  });
}
