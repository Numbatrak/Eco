import type { FastifyBaseLogger } from "fastify";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

/**
 * Stub email sender - logs only. Swap the body for a real provider later;
 * every caller goes through this one function so that's a single-file change.
 */
export async function sendEmail(logger: FastifyBaseLogger, params: SendEmailParams): Promise<void> {
  logger.info({ to: params.to, subject: params.subject }, "sendEmail (stub): would send email");
}
