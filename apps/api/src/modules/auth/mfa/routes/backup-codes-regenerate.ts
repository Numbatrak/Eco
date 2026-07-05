import type { FastifyInstance } from "fastify";
import {
  backupCodesRegenerateRequestSchema,
  type BackupCodesRegenerateResponse,
} from "@platform/shared-types";
import { findUserById } from "../../lib/users.js";
import { verifyPassword } from "../../lib/password.js";
import { logSecurityEvent } from "../../lib/security-events.js";
import { verifyCurrentMfaCode } from "../lib/verify-code.js";
import { generateBackupCodes, hashBackupCode } from "../lib/backup-codes.js";
import { deleteUnusedBackupCodes, insertBackupCodeHashes } from "../lib/backup-codes-store.js";

export default async function backupCodesRegenerateRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/2fa/backup-codes/regenerate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = backupCodesRegenerateRequestSchema.parse(request.body);
      const db = app.getDb();
      const meta = { ip: request.ip, userAgent: request.headers["user-agent"] };

      const user = await findUserById(db, request.userId);
      if (!user) {
        return reply.code(401).send({ error: "Unknown user" });
      }

      const [passwordOk, codeResult] = await Promise.all([
        verifyPassword(user.passwordHash, body.password),
        verifyCurrentMfaCode(db, user, body.code),
      ]);

      if (!passwordOk || !codeResult.ok) {
        await logSecurityEvent(db, { userId: user.id, eventType: "2fa_failed", ...meta });
        return reply.code(401).send({ error: "Password and current 2FA code are both required" });
      }

      await deleteUnusedBackupCodes(db, user.id);
      const codes = generateBackupCodes(8);
      const hashes = await Promise.all(codes.map((code) => hashBackupCode(code)));
      await insertBackupCodeHashes(db, user.id, hashes);

      await logSecurityEvent(db, { userId: user.id, eventType: "backup_codes_regenerated", ...meta });

      const response: BackupCodesRegenerateResponse = { backupCodes: codes };
      return reply.send(response);
    },
  );
}
