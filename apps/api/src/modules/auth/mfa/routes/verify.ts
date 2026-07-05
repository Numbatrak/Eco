import type { FastifyInstance, FastifyRequest } from "fastify";
import { mfaVerifyRequestSchema, type AccessTokenResponse } from "@platform/shared-types";
import {
  getMfaChallengeTtlSeconds,
  signAccessToken,
  verifyMfaChallengeToken,
} from "../../lib/jwt.js";
import { issueRefreshToken } from "../../lib/refresh-tokens.js";
import { logSecurityEvent } from "../../lib/security-events.js";
import { setRefreshTokenCookie } from "../../lib/refresh-cookie.js";
import { findUserById } from "../../lib/users.js";
import { checkChallengeAttempts } from "../../lib/rate-limit.js";
import {
  invalidateChallenge,
  isChallengeJtiUsed,
  markChallengeJtiUsed,
} from "../../lib/mfa-challenge-store.js";
import { verifyChallengeCode } from "../lib/verify-code.js";

function requestMeta(request: FastifyRequest): { ipAddress: string; userAgent?: string } {
  return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
}

export default async function verifyRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/2fa/verify", async (request, reply) => {
    const body = mfaVerifyRequestSchema.parse(request.body);
    const db = app.getDb();
    const redis = app.getRedis();
    const meta = requestMeta(request);
    const ttlSeconds = getMfaChallengeTtlSeconds();

    let sub: string;
    let jti: string;
    try {
      ({ sub, jti } = await verifyMfaChallengeToken(body.challengeToken));
    } catch {
      return reply.code(401).send({ error: "Invalid or expired challenge token" });
    }

    if (await isChallengeJtiUsed(redis, jti)) {
      await logSecurityEvent(db, { userId: sub, eventType: "2fa_failed", ...meta });
      return reply.code(401).send({ error: "Challenge token already used or invalidated" });
    }

    const attempts = await checkChallengeAttempts(redis, jti, ttlSeconds);
    if (!attempts.allowed) {
      await invalidateChallenge(redis, jti, ttlSeconds);
      await logSecurityEvent(db, { userId: sub, eventType: "2fa_failed", ...meta });
      return reply.code(429).send({ error: "Too many attempts. Please log in again." });
    }

    const user = await findUserById(db, sub);
    if (!user) {
      await logSecurityEvent(db, { eventType: "2fa_failed", ...meta });
      return reply.code(401).send({ error: "Invalid challenge" });
    }

    const result = await verifyChallengeCode(db, redis, user, jti, body.code);
    if (!result.ok) {
      await logSecurityEvent(db, { userId: sub, eventType: "2fa_failed", ...meta });
      return reply.code(401).send({ error: "Invalid code" });
    }

    const claimed = await markChallengeJtiUsed(redis, jti, ttlSeconds);
    if (!claimed) {
      await logSecurityEvent(db, { userId: sub, eventType: "2fa_failed", ...meta });
      return reply.code(401).send({ error: "Challenge token already used" });
    }

    if (result.via === "backup_code") {
      await logSecurityEvent(db, { userId: sub, eventType: "backup_code_used", ...meta });
    }

    const accessToken = await signAccessToken({ sub });
    const { token: refreshToken } = await issueRefreshToken(db, sub, meta);
    setRefreshTokenCookie(reply, refreshToken);
    await logSecurityEvent(db, { userId: sub, eventType: "2fa_verified", ...meta });

    const response: AccessTokenResponse = { accessToken };
    return reply.send(response);
  });
}
