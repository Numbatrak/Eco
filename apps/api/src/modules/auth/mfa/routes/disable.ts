import type { FastifyInstance } from "fastify";
import { mfaDisableRequestSchema } from "@platform/shared-types";
import { findUserById, updateUser } from "../../lib/users.js";
import { verifyPassword } from "../../lib/password.js";
import { logSecurityEvent } from "../../lib/security-events.js";
import { verifyCurrentMfaCode } from "../lib/verify-code.js";
import { deleteUnusedBackupCodes } from "../lib/backup-codes-store.js";

export default async function disableMfaRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/2fa/disable", { preHandler: app.authenticate }, async (request, reply) => {
    const body = mfaDisableRequestSchema.parse(request.body);
    const db = app.getDb();
    const meta = { ip: request.ip, userAgent: request.headers["user-agent"] };

    const user = await findUserById(db, request.userId);
    if (!user) {
      return reply.code(401).send({ error: "Unknown user" });
    }

    // Run both checks concurrently (rather than short-circuiting on password)
    // so a wrong password doesn't skip the slower code check and leak which
    // factor failed via response timing.
    const [passwordOk, codeResult] = await Promise.all([
      verifyPassword(user.passwordHash, body.password),
      verifyCurrentMfaCode(db, user, body.code),
    ]);

    if (!passwordOk || !codeResult.ok) {
      await logSecurityEvent(db, { userId: user.id, eventType: "2fa_failed", ...meta });
      return reply.code(401).send({ error: "Password and current 2FA code are both required" });
    }

    await updateUser(db, user.id, {
      totpSecretEncrypted: null,
      totpEnabledAt: null,
      emailOtpEnabledAt: null,
      preferred2faMethod: null,
    });
    await deleteUnusedBackupCodes(db, user.id);

    await logSecurityEvent(db, { userId: user.id, eventType: "2fa_disabled", ...meta });
    return reply.code(204).send();
  });
}
