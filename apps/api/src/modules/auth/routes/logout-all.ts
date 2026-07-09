import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import { logSecurityEvent } from "../lib/security-events.js";

export default async function logoutAllRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/logout-all", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });
    if (!session) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    const result = await auth.api.revokeSessions({ headers, asResponse: true });
    const setCookies = result.headers.getSetCookie();
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies);
    }

    const db = app.getDb();
    await logSecurityEvent(db, {
      userId: session.user.id,
      eventType: "sessions_revoked",
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.code(204).send();
  });
}
