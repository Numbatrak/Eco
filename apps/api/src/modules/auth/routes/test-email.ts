import type { FastifyInstance } from "fastify";
import { sendEmail } from "../lib/email.js";
import { testEmail } from "../../../lib/email-templates.js";

export default async function testEmailRoute(app: FastifyInstance): Promise<void> {
  app.get("/auth/test-email", async (request, reply) => {
    const to = (request.query as { to?: string }).to;
    if (!to) {
      return reply.code(400).send({ error: "Missing ?to= query param" });
    }

    await sendEmail(request.log, {
      to,
      subject: "SES Test Email",
      body: testEmail(),
    });

    return reply.send({ message: `Test email sent to ${to}` });
  });
}
