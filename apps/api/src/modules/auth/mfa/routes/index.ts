import type { FastifyInstance } from "fastify";
import verifyRoutes from "./verify.js";
import sendEmailOtpRoutes from "./send-email-otp.js";
import totpSetupRoutes from "./setup.js";
import totpConfirmRoutes from "./confirm.js";
import emailOtpSetupRoutes from "./email-otp-setup.js";
import emailOtpConfirmRoutes from "./email-otp-confirm.js";
import disableMfaRoutes from "./disable.js";
import backupCodesRegenerateRoutes from "./backup-codes-regenerate.js";
import mfaStatusRoutes from "./status.js";

export default async function mfaRoutes(app: FastifyInstance): Promise<void> {
  await app.register(verifyRoutes);
  await app.register(sendEmailOtpRoutes);
  await app.register(totpSetupRoutes);
  await app.register(totpConfirmRoutes);
  await app.register(emailOtpSetupRoutes);
  await app.register(emailOtpConfirmRoutes);
  await app.register(disableMfaRoutes);
  await app.register(backupCodesRegenerateRoutes);
  await app.register(mfaStatusRoutes);
}
