import type { FastifyInstance } from "fastify";
import { passwordResetRequestSchema, passwordResetCompleteSchema } from "@platform/shared-types";
import { isAPIError } from "better-auth/api";
import { auth } from "../../../lib/auth.js";
import { logSecurityEvent } from "../lib/security-events.js";

export default async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/password-reset/request", async (request, reply) => {
    const body = passwordResetRequestSchema.parse(request.body);
    const db = app.getDb();

    // requestPasswordReset itself doesn't leak whether the email exists (it
    // no-ops silently for unknown emails), so no extra care is needed here
    // to avoid enumeration - always 202 regardless.
    await auth.api.requestPasswordReset({ body: { email: body.email } });
    await logSecurityEvent(db, { eventType: "password_reset_requested" });

    return reply.code(202).send({ message: "If that email is registered, a reset link was sent." });
  });

  app.post("/auth/password-reset/complete", async (request, reply) => {
    const body = passwordResetCompleteSchema.parse(request.body);
    const db = app.getDb();

    try {
      await auth.api.resetPassword({ body: { newPassword: body.newPassword, token: body.token } });
    } catch (error) {
      if (isAPIError(error)) {
        return reply.code(400).send({ error: "Invalid or expired reset token" });
      }
      throw error;
    }

    await logSecurityEvent(db, { eventType: "password_reset_completed" });
    return reply.code(204).send();
  });
}
