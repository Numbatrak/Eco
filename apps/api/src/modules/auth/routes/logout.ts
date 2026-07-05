import type { FastifyInstance } from "fastify";
import { findActiveRefreshTokenRow, revokeRefreshTokenRow } from "../lib/refresh-tokens.js";
import { REFRESH_TOKEN_COOKIE, clearRefreshTokenCookie } from "../lib/refresh-cookie.js";

export default async function logoutRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/logout", async (request, reply) => {
    const presentedToken = request.cookies[REFRESH_TOKEN_COOKIE];
    if (presentedToken) {
      const db = app.getDb();
      const row = await findActiveRefreshTokenRow(db, presentedToken);
      if (row) {
        await revokeRefreshTokenRow(db, row.id);
      }
    }
    clearRefreshTokenCookie(reply);
    return reply.code(204).send();
  });
}
