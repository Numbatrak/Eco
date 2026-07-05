import type { FastifyInstance } from "fastify";
import { mfaSendEmailOtpRequestSchema } from "@platform/shared-types";
import { verifyMfaChallengeToken } from "../../lib/jwt.js";
import { checkEmailOtpResend } from "../../lib/rate-limit.js";
import {
  isChallengeJtiUsed,
  storeEmailOtp,
} from "../../lib/mfa-challenge-store.js";
import { findUserById } from "../../lib/users.js";
import { sendEmail } from "../../lib/email.js";
import { generateEmailOtpCode, hashEmailOtp } from "../lib/email-otp.js";

const EMAIL_OTP_TTL_SECONDS = 10 * 60;

export default async function sendEmailOtpRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/2fa/send-email-otp", async (request, reply) => {
    const body = mfaSendEmailOtpRequestSchema.parse(request.body);
    const db = app.getDb();
    const redis = app.getRedis();

    let sub: string;
    let jti: string;
    try {
      ({ sub, jti } = await verifyMfaChallengeToken(body.challengeToken));
    } catch {
      return reply.code(401).send({ error: "Invalid or expired challenge token" });
    }

    if (await isChallengeJtiUsed(redis, jti)) {
      return reply.code(401).send({ error: "Challenge token already used or invalidated" });
    }

    const resend = await checkEmailOtpResend(redis, jti);
    if (!resend.allowed) {
      return reply.code(429).send({ error: "Too many OTP send requests. Try again later." });
    }

    const user = await findUserById(db, sub);
    if (!user) {
      return reply.code(401).send({ error: "Invalid challenge" });
    }

    const code = generateEmailOtpCode();
    const codeHash = await hashEmailOtp(code);
    await storeEmailOtp(redis, jti, codeHash, EMAIL_OTP_TTL_SECONDS);
    await sendEmail(app.log, {
      to: user.email,
      subject: "Your verification code",
      body: `Your verification code is ${code}. It expires in 10 minutes.`,
    });

    return reply.code(202).send({ message: "Verification code sent." });
  });
}
