import type { FastifyInstance } from "fastify";
import { submitPublicNumbatrakFormRequestSchema } from "@platform/shared-types";
import { extractProductIdsFromSchema, fetchProductNames } from "../lib/public-form.js";
import { findActiveFormByToken, submitFormOrder } from "../lib/intake.js";
import { checkAndIncrementRateLimit } from "../../auth/lib/rate-limit.js";

const NUMBATRAK_FORM_RATE_LIMIT_WINDOW_SECONDS = 60;

// Shared IP budget across the schema-fetch (GET) and submit (POST) routes -
// both are the same threat surface (probing/brute-forcing form tokens), so
// they draw from the same counter rather than each getting their own.
function numbatrakFormRateLimitPerMinute(): number {
  const raw = process.env.NUMBATRAK_FORM_RATE_LIMIT_PER_MINUTE;
  return raw ? Number(raw) : 20;
}

/**
 * The one genuinely public/unauthenticated surface in the whole Numbatrak
 * port - hit directly from arbitrary third-party WordPress sites embedding
 * a `[crm_form]` shortcode, so it needs permissive CORS (any origin, no
 * credentials/cookies) instead of the API-wide first-party-origin-only
 * policy in plugins/cors.ts. Each route below sets `config: { cors: false }`,
 * which the global @fastify/cors plugin's own onRequest hook honors (it
 * checks `req.routeOptions.config?.cors === false` and no-ops instead of
 * applying/enforcing the first-party allowlist) - see plugins/cors.ts for
 * why this opt-out, rather than a second @fastify/cors registration or a
 * path check inside its `origin` option, is the only mechanism that works.
 * This plugin's own onRequest hook then sets permissive headers directly,
 * for its own encapsulated routes only. No requireOrgPermission anywhere
 * here - the form token itself is the sole public-safe capability, matching
 * the source app's own RLS-by-token model (no anon API key needed at all).
 */
export default async function publicNumbatrakFormRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      reply.code(204).send();
    }
  });

  // Explicit OPTIONS handlers so preflight requests always match a route
  // (the onRequest hook above still runs first and sets the headers).
  app.options("/public/numbatrak/forms/:formToken", { config: { cors: false } }, async (_request, reply) =>
    reply.code(204).send(),
  );
  app.options("/public/numbatrak/forms/:formToken/submit", { config: { cors: false } }, async (_request, reply) =>
    reply.code(204).send(),
  );

  app.get<{ Params: { formToken: string } }>(
    "/public/numbatrak/forms/:formToken",
    { config: { cors: false } },
    async (request, reply) => {
      const redis = app.getRedis();
      const rate = await checkAndIncrementRateLimit(redis, `numbatrak-form:ip:${request.ip}`, {
        limit: numbatrakFormRateLimitPerMinute(),
        windowSeconds: NUMBATRAK_FORM_RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rate.allowed) {
        return reply.code(429).send({ error: "Too many requests. Please try again shortly." });
      }

      const db = app.getDb();
      const form = await findActiveFormByToken(db, request.params.formToken);
      if (!form || !form.active) {
        return reply.code(404).send({ error: "Form not found" });
      }

      const productIds = extractProductIdsFromSchema(form.schema);
      const products = await fetchProductNames(db, form.organizationId, productIds);

      return reply.send({
        form: {
          id: form.id,
          name: form.name,
          schema: form.schema,
          funnelName: form.funnelName,
          subBrand: form.subBrand,
        },
        products,
      });
    },
  );

  app.post<{ Params: { formToken: string } }>(
    "/public/numbatrak/forms/:formToken/submit",
    { config: { cors: false } },
    async (request, reply) => {
      const redis = app.getRedis();
      const rate = await checkAndIncrementRateLimit(redis, `numbatrak-form:ip:${request.ip}`, {
        limit: numbatrakFormRateLimitPerMinute(),
        windowSeconds: NUMBATRAK_FORM_RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rate.allowed) {
        return reply.code(429).send({ error: "Too many requests. Please try again shortly." });
      }

      const db = app.getDb();
      const form = await findActiveFormByToken(db, request.params.formToken);
      if (!form || !form.active) {
        return reply.code(404).send({ error: "Form not found" });
      }

      const body = submitPublicNumbatrakFormRequestSchema.parse(request.body);
      try {
        const result = await submitFormOrder(db, form, {
          fieldValues: body.fieldValues,
          items: body.items,
          source: body.source,
          pageUrl: body.pageUrl,
          offerName: body.offerName,
          packageName: body.packageName,
        });
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        return reply.code(400).send({ error: message });
      }
    },
  );
}
