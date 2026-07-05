import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { loginRequestSchema, type LoginResponse } from "@platform/shared-types";
import { verifyPassword, verifyPasswordConstantTimeForUnknownUser } from "../lib/password.js";
import { findUserByEmail } from "../lib/users.js";
import { signAccessToken, signMfaChallengeToken } from "../lib/jwt.js";
import { issueRefreshToken } from "../lib/refresh-tokens.js";
import { logSecurityEvent } from "../lib/security-events.js";
import { setRefreshTokenCookie } from "../lib/refresh-cookie.js";

function requestMeta(request: FastifyRequest): { ipAddress: string; userAgent?: string } {
  return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
}

export default async function loginRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const db = app.getDb();
    const meta = requestMeta(request);

    const user = await findUserByEmail(db, body.email);
    if (!user) {
      // Run a dummy argon2 verify so failing here takes the same time as a
      // wrong password for a real user - otherwise response timing leaks
      // which emails are registered.
      await verifyPasswordConstantTimeForUnknownUser();
      await logSecurityEvent(db, { eventType: "login_failed", ...meta });
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const passwordOk = await verifyPassword(user.passwordHash, body.password);
    if (!passwordOk) {
      await logSecurityEvent(db, { userId: user.id, eventType: "login_failed", ...meta });
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    if (!user.preferred2faMethod) {
      const accessToken = await signAccessToken({ sub: user.id });
      const { token: refreshToken } = await issueRefreshToken(db, user.id, meta);
      setRefreshTokenCookie(reply, refreshToken);
      await logSecurityEvent(db, { userId: user.id, eventType: "login_success", ...meta });
      const response: LoginResponse = { status: "authenticated", accessToken };
      return reply.send(response);
    }

    const challengeJti = randomUUID();
    const challengeToken = await signMfaChallengeToken({ sub: user.id, jti: challengeJti });
    await logSecurityEvent(db, { userId: user.id, eventType: "2fa_challenge_issued", ...meta });
    const response: LoginResponse = {
      status: "mfa_required",
      challengeToken,
      method: user.preferred2faMethod,
    };
    return reply.send(response);
  });
}
