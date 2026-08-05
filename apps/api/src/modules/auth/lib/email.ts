import type { FastifyBaseLogger } from "fastify";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(logger: FastifyBaseLogger, params: SendEmailParams): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "noreply@yourdomain.com";
  const region = process.env.AWS_REGION;

  if (!region) {
    logger.info({ to: params.to, subject: params.subject }, "sendEmail (stub): no AWS_REGION set");
    return;
  }

  const ses = new SESClient({ region });

  try {
    const result = await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: { Html: { Data: params.body, Charset: "UTF-8" } },
        },
      }),
    );
    logger.info({ to: params.to, subject: params.subject, id: result.MessageId }, "Email sent");
  } catch (err) {
    logger.error({ err, to: params.to }, "Failed to send email");
    throw err;
  }
}
