import type { FastifyInstance } from "fastify";
import { logoutRequestSchema } from "@platform/shared-types";
import { findActiveRefreshTokenRow, revokeRefreshTokenRow } from "../lib/refresh-tokens.js";

export default async function logoutRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/logout", async (request, reply) => {
    const body = logoutRequestSchema.parse(request.body);
    const db = app.getDb();

    const row = await findActiveRefreshTokenRow(db, body.refreshToken);
    if (row) {
      await revokeRefreshTokenRow(db, row.id);
    }
    return reply.code(204).send();
  });
}
