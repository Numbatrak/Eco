import type { FastifyInstance } from "fastify";
import { checkRateLimitOrAllow } from "../../auth/lib/rate-limit.js";
import {
  findOrgByIntakeToken,
  getOrCreateIntakeToken,
  isIntakeProvider,
  rotateIntakeToken,
  submitOrgIntake,
} from "../lib/org-intake.js";
import { FIELD_ALIASES, parseUrlEncodedBody } from "../lib/payload.js";

const INTAKE_RATE_LIMIT_WINDOW_SECONDS = 60;

function intakeRateLimitPerMinute(): number {
  const raw = process.env.NUMBATRAK_FORM_RATE_LIMIT_PER_MINUTE;
  return raw ? Number(raw) : 20;
}

/**
 * The org-wide form intake address: one webhook URL a business pastes into
 * any Fluent Forms / Elementor form on any of its sites, instead of one per
 * NumbaTrak form. The token in the path is the secret (same model as a
 * Zapier catch-hook); it's rotated from the Form integrations page.
 * Server-to-server only, so no CORS opt-out; errors are real 4xxs so the
 * plugin's webhook log tells the business what to fix.
 */
export default async function orgIntakeRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, parseUrlEncodedBody(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post<{ Params: { intakeToken: string; provider: string }; Querystring: { funnel?: string } }>(
    "/public/numbatrak/intake/:intakeToken/:provider",
    async (request, reply) => {
      const rate = await checkRateLimitOrAllow(
        () => app.getRedis(),
        `numbatrak-intake:ip:${request.ip}`,
        { limit: intakeRateLimitPerMinute(), windowSeconds: INTAKE_RATE_LIMIT_WINDOW_SECONDS },
        request.log,
      );
      if (!rate.allowed) {
        return reply.code(429).send({ error: "Too many requests. Please try again shortly." });
      }

      const { intakeToken, provider } = request.params;
      if (!isIntakeProvider(provider)) {
        return reply.code(404).send({ error: "Unknown form plugin in the address" });
      }

      const db = app.getDb();
      const organizationId = await findOrgByIntakeToken(db, intakeToken);
      if (!organizationId) {
        return reply.code(404).send({ error: "This intake address isn't active. Copy the current one from NumbaTrak." });
      }

      try {
        const result = await submitOrgIntake(
          db,
          organizationId,
          { provider, body: request.body, funnel: request.query.funnel ?? null },
          request.log,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        return reply.code(400).send({ error: message });
      }
    },
  );

  app.get(
    "/org/numbatrak/form-intake",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["view"] }) },
    async (request, reply) => {
      const token = await getOrCreateIntakeToken(app.getDb(), request.activeOrganizationId!);
      return reply.send({ token, fieldAliases: FIELD_ALIASES });
    },
  );

  app.post(
    "/org/numbatrak/form-intake/rotate",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["update"] }) },
    async (request, reply) => {
      const token = await rotateIntakeToken(app.getDb(), request.activeOrganizationId!);
      return reply.send({ token });
    },
  );
}
