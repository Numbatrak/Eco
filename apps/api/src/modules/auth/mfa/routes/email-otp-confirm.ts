import type { FastifyInstance } from "fastify";
import { emailOtpConfirmRequestSchema } from "@platform/shared-types";
import { findUserById, updateUser } from "../../lib/users.js";
import { logSecurityEvent } from "../../lib/security-events.js";
import { verifyEmailOtp } from "../lib/email-otp.js";
import {
  getEmailOtpEnrollmentHash,
  clearEmailOtpEnrollmentCode,
} from "../lib/email-otp-enrollment-store.js";

export default async function emailOtpConfirmRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/2fa/email-otp/confirm",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = emailOtpConfirmRequestSchema.parse(request.body);
      const db = app.getDb();
      const redis = app.getRedis();
      const user = await findUserById(db, request.userId);
      if (!user) {
        return reply.code(401).send({ error: "Unknown user" });
      }

      const hash = await getEmailOtpEnrollmentHash(redis, user.id);
      if (!hash || !(await verifyEmailOtp(hash, body.code))) {
        return reply.code(401).send({ error: "Invalid code" });
      }
      await clearEmailOtpEnrollmentCode(redis, user.id);

      await updateUser(db, user.id, {
        emailOtpEnabledAt: new Date(),
        preferred2faMethod: user.preferred2faMethod ?? "email_otp",
      });

      await logSecurityEvent(db, {
        userId: user.id,
        eventType: "2fa_enabled",
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return reply.code(204).send();
    },
  );
}
