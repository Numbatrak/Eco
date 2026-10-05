import type { FastifyInstance } from "fastify";
import { findActiveFormByToken, submitFormOrder } from "../lib/intake.js";
import { verifyFormWebhookSecret } from "../lib/forms.js";
import { flattenElementorPayload, resolveContactFields, resolveItems, resolveTrackingLinkCode } from "../lib/elementor.js";
import { checkAndIncrementRateLimit } from "../../auth/lib/rate-limit.js";
import type { NumbatrakFormFieldMapping } from "@platform/shared-types";

const NUMBATRAK_FORM_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS = 60;

function numbatrakFormWebhookRateLimitPerMinute(): number {
  const raw = process.env.NUMBATRAK_FORM_RATE_LIMIT_PER_MINUTE;
  return raw ? Number(raw) : 20;
}

/**
 * Server-to-server intake from Elementor Pro's native Webhook form action -
 * unlike public.ts's browser-embedded /submit route, this is never called
 * from a page's own JS, so it doesn't need the permissive any-origin CORS
 * opt-out. Elementor's webhook action can't sign requests, so a shared secret
 * (rotated from the authenticated form settings, see routes/webhook-secret.ts)
 * embedded in the URL/header is the realistic trust boundary here - the same
 * class of model Zapier/Make catch-hooks use. Unlike public.ts's honeypot
 * (aimed at anonymous browser bots), failures here return real 4xxs: this is
 * the merchant's own webhook delivery, and clear errors help them fix a bad
 * field mapping rather than needing to avoid tipping off an attacker.
 */
export default async function publicNumbatrakFormWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { formToken: string }; Querystring: { secret?: string } }>(
    "/public/numbatrak/forms/:formToken/webhook/elementor",
    async (request, reply) => {
      const redis = app.getRedis();
      const rate = await checkAndIncrementRateLimit(redis, `numbatrak-form-webhook:ip:${request.ip}`, {
        limit: numbatrakFormWebhookRateLimitPerMinute(),
        windowSeconds: NUMBATRAK_FORM_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rate.allowed) {
        return reply.code(429).send({ error: "Too many requests. Please try again shortly." });
      }

      const db = app.getDb();
      const form = await findActiveFormByToken(db, request.params.formToken);
      if (!form || !form.active) {
        return reply.code(404).send({ error: "Form not found" });
      }

      const providedSecret =
        (request.headers["x-numbatrak-webhook-secret"] as string | undefined) ?? request.query.secret;
      if (!verifyFormWebhookSecret(form, providedSecret)) {
        return reply.code(401).send({ error: "Invalid or missing webhook secret" });
      }

      const mapping = (form.fieldMapping as NumbatrakFormFieldMapping | null) ?? {
        contactFields: {},
        valueToOptionId: {},
      };
      const flat = flattenElementorPayload(request.body);
      const fieldValues = resolveContactFields(flat, mapping.contactFields ?? {});
      const items = resolveItems(flat, mapping, form.schema);
      const trackingLinkCode = resolveTrackingLinkCode(flat, mapping);

      try {
        const result = await submitFormOrder(
          db,
          form,
          {
            fieldValues,
            items,
            source: "elementor",
            pageUrl: null,
            trackingLinkCode,
          },
          request.log,
        );
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        return reply.code(400).send({ error: message });
      }
    },
  );
}
