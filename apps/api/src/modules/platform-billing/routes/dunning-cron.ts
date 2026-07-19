import type { FastifyInstance } from "fastify";
import { runDunningTick } from "../lib/dunning.js";

/**
 * POST /platform-billing/cron/dunning-tick
 *
 * Protected by X-Cron-Secret header matched against PLATFORM_CRON_SECRET env
 * var. Call this on a regular schedule (e.g. hourly via external cron, Cloud
 * Scheduler, or GitHub Actions) to advance the dunning state machine:
 *
 *   past_due → locked (after 48h grace period expires)
 *   locked   → cancelled + org suspended (after 90 days)
 */
export default async function dunningCronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/platform-billing/cron/dunning-tick", async (request, reply) => {
    const secret = process.env.PLATFORM_CRON_SECRET;
    if (!secret) {
      app.log.error("PLATFORM_CRON_SECRET not set — dunning cron is disabled");
      return reply.code(503).send({ error: "cron_not_configured" });
    }
    const provided = request.headers["x-cron-secret"];
    if (provided !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const result = await runDunningTick(app.getDb(), app.log);
    return reply.send({
      ok: true,
      lockedCount: result.locked.length,
      expiredCount: result.expired.length,
    });
  });
}
