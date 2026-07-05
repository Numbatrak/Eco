import type { FastifyInstance } from "fastify";
import type { MessageResponse } from "@platform/shared-types";
import { findUserById } from "../../lib/users.js";
import { sendEmail } from "../../lib/email.js";
import { generateEmailOtpCode, hashEmailOtp } from "../lib/email-otp.js";
import { storeEmailOtpEnrollmentCode } from "../lib/email-otp-enrollment-store.js";

const ENROLLMENT_CODE_TTL_SECONDS = 10 * 60;

export default async function emailOtpSetupRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/2fa/email-otp/setup",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const db = app.getDb();
      const redis = app.getRedis();
      const user = await findUserById(db, request.userId);
      if (!user) {
        return reply.code(401).send({ error: "Unknown user" });
      }

      const code = generateEmailOtpCode();
      const codeHash = await hashEmailOtp(code);
      await storeEmailOtpEnrollmentCode(redis, user.id, codeHash, ENROLLMENT_CODE_TTL_SECONDS);
      await sendEmail(app.log, {
        to: user.email,
        subject: "Your verification code",
        body: `Your verification code is ${code}. It expires in 10 minutes.`,
      });

      const response: MessageResponse = { message: "Verification code sent." };
      return reply.code(202).send(response);
    },
  );
}
