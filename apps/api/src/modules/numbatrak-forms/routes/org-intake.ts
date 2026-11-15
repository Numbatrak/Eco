import type { FastifyInstance } from "fastify";
import { checkRateLimitOrAllow } from "../../auth/lib/rate-limit.js";
import {
  createExternalForm,
  DuplicateFormNameError,
  externalFormProvider,
  findExternalForm,
  findOrgByIntakeToken,
  getOrCreateIntakeToken,
  isIntakeProvider,
  listExternalForms,
  listRecentSubmissions,
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
 * Webhook intake for forms on the business's own website (Fluent Forms,
 * Elementor). Every address names one website form -
 * /public/numbatrak/intake/:intakeToken/:formId - and that form is a funnel
 * in NumbaTrak, so each website form's orders stay apart on the dashboard.
 * There is deliberately no form-less address.
 *
 * The org token in the path is the secret (same model as a Zapier
 * catch-hook); it's rotated from Form Integrations. Server-to-server only,
 * so no CORS opt-out; errors are real 4xxs so the plugin's webhook log
 * tells the business what to fix.
 */
export default async function orgIntakeRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, parseUrlEncodedBody(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post<{ Params: { intakeToken: string; formId: string } }>(
    "/public/numbatrak/intake/:intakeToken/:formId",
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

      const { intakeToken, formId } = request.params;
      // The first release handed out one shared address ending in the plugin
      // name. Every form now needs its own named address.
      if (isIntakeProvider(formId)) {
        return reply.code(400).send({
          error:
            "This address isn't linked to a form. In NumbaTrak, open Form Integrations, name this form, and paste its own address here.",
        });
      }

      const db = app.getDb();
      const organizationId = await findOrgByIntakeToken(db, intakeToken);
      if (!organizationId) {
        return reply.code(404).send({ error: "This address isn't active. Copy the current one from NumbaTrak." });
      }
      const form = await findExternalForm(db, organizationId, formId);
      if (!form) {
        return reply
          .code(404)
          .send({ error: "This form was removed or switched off in NumbaTrak. Copy its current address from Form Integrations." });
      }

      try {
        const result = await submitOrgIntake(
          db,
          form,
          { provider: externalFormProvider(form.schema)!, body: request.body },
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
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const [token, forms] = await Promise.all([
        getOrCreateIntakeToken(db, organizationId),
        listExternalForms(db, organizationId),
      ]);
      return reply.send({ token, forms, fieldAliases: FIELD_ALIASES });
    },
  );

  app.post<{ Body: { name?: unknown; provider?: unknown } }>(
    "/org/numbatrak/form-intake/forms",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["create"] }) },
    async (request, reply) => {
      const { name, provider } = request.body ?? {};
      if (typeof name !== "string" || typeof provider !== "string" || !isIntakeProvider(provider)) {
        return reply.code(400).send({ error: "A form name and plugin are required" });
      }
      try {
        const form = await createExternalForm(app.getDb(), request.activeOrganizationId!, { name, provider });
        return reply.code(201).send({ form });
      } catch (err) {
        const status = err instanceof DuplicateFormNameError ? 409 : 400;
        return reply.code(status).send({ error: err instanceof Error ? err.message : "Couldn't create the form" });
      }
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

  app.get<{ Querystring: { formId?: string } }>(
    "/org/numbatrak/form-intake/recent",
    { preHandler: app.requireOrgPermission({ numbatrakForms: ["view"] }) },
    async (request, reply) => {
      const submissions = await listRecentSubmissions(app.getDb(), request.activeOrganizationId!, {
        formId: request.query.formId ?? null,
      });
      return reply.send({ submissions });
    },
  );
}
