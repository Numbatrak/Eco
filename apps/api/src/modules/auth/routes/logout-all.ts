import type { FastifyInstance } from "fastify";
import { revokeAllRefreshTokens } from "../lib/refresh-tokens.js";
import { logSecurityEvent } from "../lib/security-events.js";

export default async function logoutAllRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/logout-all", { preHandler: app.authenticate }, async (request, reply) => {
    const db = app.getDb();
    await revokeAllRefreshTokens(db, request.userId);
    await logSecurityEvent(db, {
      userId: request.userId,
      eventType: "sessions_revoked",
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.code(204).send();
  });
}
