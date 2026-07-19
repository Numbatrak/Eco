import type { FastifyBaseLogger } from "fastify";
import Mailgun from "mailgun.js";
import FormData from "form-data";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

function getMailgunClient() {
  const mailgun = new Mailgun(FormData);
  return mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY!,
  });
}

export async function sendEmail(logger: FastifyBaseLogger, params: SendEmailParams): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "noreply@yourdomain.com";
  const domain = process.env.MAILGUN_DOMAIN;

  if (!process.env.MAILGUN_API_KEY || !domain) {
    logger.info({ to: params.to, subject: params.subject }, "sendEmail (stub): no MAILGUN_API_KEY/MAILGUN_DOMAIN set");
    return;
  }

  const mg = getMailgunClient();

  const result = await mg.messages.create(domain, {
    from,
    to: [params.to],
    subject: params.subject,
    html: params.body,
  });

  if (result.status !== 200) {
    logger.error({ result, to: params.to }, "Failed to send email");
    throw new Error(`Email send failed: ${result.message}`);
  }

  logger.info({ to: params.to, subject: params.subject, id: result.id }, "Email sent");
}
