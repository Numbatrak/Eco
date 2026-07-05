import type { FastifyInstance } from "fastify";
import { type AccessTokenResponse } from "@platform/shared-types";
import { signAccessToken, verifyRefreshToken } from "../lib/jwt.js";
import {
  findActiveRefreshTokenRow,
  issueRefreshToken,
  revokeRefreshTokenRow,
} from "../lib/refresh-tokens.js";
import {
  REFRESH_TOKEN_COOKIE,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../lib/refresh-cookie.js";

export default async function refreshRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/refresh", async (request, reply) => {
    const presentedToken = request.cookies[REFRESH_TOKEN_COOKIE];
    if (!presentedToken) {
      return reply.code(401).send({ error: "No refresh token cookie present" });
    }

    const db = app.getDb();

    let sub: string;
    try {
      ({ sub } = await verifyRefreshToken(presentedToken));
    } catch {
      clearRefreshTokenCookie(reply);
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }

    const row = await findActiveRefreshTokenRow(db, presentedToken);
    if (!row || row.userId !== sub) {
      clearRefreshTokenCookie(reply);
      return reply.code(401).send({ error: "Refresh token has been revoked or is unknown" });
    }

    await revokeRefreshTokenRow(db, row.id);
    const { token: refreshToken } = await issueRefreshToken(db, sub, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    setRefreshTokenCookie(reply, refreshToken);
    const accessToken = await signAccessToken({ sub });

    const response: AccessTokenResponse = { accessToken };
    return reply.send(response);
  });
}
