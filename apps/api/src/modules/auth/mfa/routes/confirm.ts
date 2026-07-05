import type { FastifyInstance } from "fastify";
import { totpConfirmRequestSchema, type TotpConfirmResponse } from "@platform/shared-types";
import { findUserById, updateUser } from "../../lib/users.js";
import { decryptTotpSecret } from "../../lib/totp-encryption.js";
import { logSecurityEvent } from "../../lib/security-events.js";
import { verifyTotpCode } from "../lib/totp.js";
import { generateBackupCodes, hashBackupCode } from "../lib/backup-codes.js";
import { insertBackupCodeHashes } from "../lib/backup-codes-store.js";

export default async function totpConfirmRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/2fa/totp/confirm", { preHandler: app.authenticate }, async (request, reply) => {
    const body = totpConfirmRequestSchema.parse(request.body);
    const db = app.getDb();
    const user = await findUserById(db, request.userId);
    if (!user || !user.totpSecretEncrypted) {
      return reply.code(400).send({ error: "No pending TOTP setup. Call /auth/2fa/totp/setup first." });
    }

    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (!verifyTotpCode(secret, body.code)) {
      return reply.code(401).send({ error: "Invalid code" });
    }

    await updateUser(db, user.id, {
      totpEnabledAt: new Date(),
      preferred2faMethod: user.preferred2faMethod ?? "totp",
    });

    const codes = generateBackupCodes(8);
    const hashes = await Promise.all(codes.map((code) => hashBackupCode(code)));
    await insertBackupCodeHashes(db, user.id, hashes);

    await logSecurityEvent(db, {
      userId: user.id,
      eventType: "2fa_enabled",
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    const response: TotpConfirmResponse = { backupCodes: codes };
    return reply.send(response);
  });
}
