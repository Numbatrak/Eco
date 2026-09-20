import type { FastifyInstance } from "fastify";
import { runDailySummaryEmails } from "../lib/daily-summary.js";

/**
 * POST /numbatrak/cron/daily-summary
 *
 * Protected by X-Cron-Secret header matched against NUMBATRAK_CRON_SECRET
 * env var - same pattern as platform-billing's dunning-cron.ts and
 * checkout's sweep-abandoned-cron.ts. Triggered daily at 00:00 WAT (23:00
 * UTC) by .github/workflows/daily-summary-cron.yml.
 */
export default async function dailySummaryCronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/numbatrak/cron/daily-summary", async (request, reply) => {
    const secret = process.env.NUMBATRAK_CRON_SECRET;
    if (!secret) {
      app.log.error("NUMBATRAK_CRON_SECRET not set — daily summary cron is disabled");
      return reply.code(503).send({ error: "cron_not_configured" });
    }
    const provided = request.headers["x-cron-secret"];
    if (provided !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const result = await runDailySummaryEmails(app.getDb(), app.log);
    return reply.send({ ok: true, sentCount: result.sent.length, skippedCount: result.skipped.length });
  });
}
