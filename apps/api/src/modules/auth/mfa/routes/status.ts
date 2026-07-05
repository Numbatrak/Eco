import type { FastifyInstance } from "fastify";
import { type MfaStatusResponse } from "@platform/shared-types";
import { findUserById } from "../../lib/users.js";
import { listUnusedBackupCodes } from "../lib/backup-codes-store.js";

export default async function mfaStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/2fa/status", { preHandler: app.authenticate }, async (request, reply) => {
    const db = app.getDb();
    const user = await findUserById(db, request.userId);
    if (!user) {
      return reply.code(401).send({ error: "Unknown user" });
    }

    const unused = await listUnusedBackupCodes(db, user.id);

    const response: MfaStatusResponse = {
      totpEnabled: Boolean(user.totpEnabledAt),
      emailOtpEnabled: Boolean(user.emailOtpEnabledAt),
      preferredMethod: user.preferred2faMethod,
      unusedBackupCodeCount: unused.length,
    };
    return reply.send(response);
  });
}
