import type { FastifyInstance } from "fastify";
import { type TotpSetupResponse } from "@platform/shared-types";
import { findUserById, updateUser } from "../../lib/users.js";
import { encryptTotpSecret } from "../../lib/totp-encryption.js";
import { buildOtpauthUri, generateTotpSecret } from "../lib/totp.js";

export default async function totpSetupRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/2fa/totp/setup", { preHandler: app.authenticate }, async (request, reply) => {
    const db = app.getDb();
    const user = await findUserById(db, request.userId);
    if (!user) {
      return reply.code(401).send({ error: "Unknown user" });
    }

    const secret = generateTotpSecret();
    await updateUser(db, user.id, { totpSecretEncrypted: encryptTotpSecret(secret) });

    const response: TotpSetupResponse = {
      otpauthUrl: buildOtpauthUri(secret, user.email),
      secret,
    };
    return reply.send(response);
  });
}
