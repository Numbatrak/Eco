import type { FastifyInstance } from "fastify";
import {
  passwordResetRequestSchema,
  passwordResetCompleteSchema,
} from "@platform/shared-types";
import { generateOpaqueToken, sha256Hex } from "../lib/tokens.js";
import { hashPassword } from "../lib/password.js";
import { findUserByEmail, updateUser } from "../lib/users.js";
import { revokeAllRefreshTokens } from "../lib/refresh-tokens.js";
import { logSecurityEvent } from "../lib/security-events.js";
import { sendEmail } from "../lib/email.js";

const RESET_TOKEN_TTL_SECONDS = 15 * 60;

function resetTokenKey(hash: string): string {
  return `pwreset:${hash}`;
}

export default async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/password-reset/request", async (request, reply) => {
    const body = passwordResetRequestSchema.parse(request.body);
    const db = app.getDb();
    const redis = app.getRedis();

    const user = await findUserByEmail(db, body.email);
    if (user) {
      const token = generateOpaqueToken();
      await redis.set(resetTokenKey(sha256Hex(token)), user.id, "EX", RESET_TOKEN_TTL_SECONDS);
      await sendEmail(app.log, {
        to: user.email,
        subject: "Reset your password",
        body: `Use this token to reset your password: ${token}`,
      });
      await logSecurityEvent(db, { userId: user.id, eventType: "password_reset_requested" });
    }

    // Always 202, regardless of whether the email exists, to avoid leaking
    // which addresses are registered.
    return reply.code(202).send({ message: "If that email is registered, a reset link was sent." });
  });

  app.post("/auth/password-reset/complete", async (request, reply) => {
    const body = passwordResetCompleteSchema.parse(request.body);
    const db = app.getDb();
    const redis = app.getRedis();

    const key = resetTokenKey(sha256Hex(body.token));
    const userId = await redis.get(key);
    if (!userId) {
      return reply.code(400).send({ error: "Invalid or expired reset token" });
    }
    await redis.del(key);

    const passwordHash = await hashPassword(body.newPassword);
    await updateUser(db, userId, { passwordHash });

    await revokeAllRefreshTokens(db, userId);
    await logSecurityEvent(db, { userId, eventType: "password_reset_completed" });
    await logSecurityEvent(db, { userId, eventType: "sessions_revoked" });

    return reply.code(204).send();
  });
}
