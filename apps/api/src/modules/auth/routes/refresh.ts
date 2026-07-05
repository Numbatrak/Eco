import type { FastifyInstance, FastifyRequest } from "fastify";
import { refreshRequestSchema, type TokenPair } from "@platform/shared-types";
import { signAccessToken, verifyRefreshToken } from "../lib/jwt.js";
import {
  findActiveRefreshTokenRow,
  issueRefreshToken,
  revokeRefreshTokenRow,
} from "../lib/refresh-tokens.js";

function requestMeta(request: FastifyRequest): { ipAddress: string; userAgent?: string } {
  return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
}

export default async function refreshRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshRequestSchema.parse(request.body);
    const db = app.getDb();

    let sub: string;
    try {
      ({ sub } = await verifyRefreshToken(body.refreshToken));
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }

    const row = await findActiveRefreshTokenRow(db, body.refreshToken);
    if (!row || row.userId !== sub) {
      return reply.code(401).send({ error: "Refresh token has been revoked or is unknown" });
    }

    await revokeRefreshTokenRow(db, row.id);
    const { token: refreshToken } = await issueRefreshToken(db, sub, requestMeta(request));
    const accessToken = await signAccessToken({ sub });

    const response: TokenPair = { accessToken, refreshToken };
    return reply.send(response);
  });
}
