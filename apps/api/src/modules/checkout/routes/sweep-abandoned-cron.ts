import type { FastifyInstance } from "fastify";
import { runAbandonedCheckoutSweep } from "../lib/abandoned-checkout-sweep.js";

/**
 * POST /checkout/cron/sweep-abandoned
 *
 * Protected by X-Cron-Secret header matched against CHECKOUT_CRON_SECRET env
 * var. Call this on a regular schedule (e.g. hourly via external cron, Cloud
 * Scheduler, or GitHub Actions) to flag stale pending online-payment orders
 * as abandoned and send a recovery nudge - see platform-billing's
 * dunning-cron.ts for the sibling job this mirrors.
 */
export default async function sweepAbandonedCronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/checkout/cron/sweep-abandoned", async (request, reply) => {
    const secret = process.env.CHECKOUT_CRON_SECRET;
    if (!secret) {
      app.log.error("CHECKOUT_CRON_SECRET not set — abandoned-checkout sweep is disabled");
      return reply.code(503).send({ error: "cron_not_configured" });
    }
    const provided = request.headers["x-cron-secret"];
    if (provided !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const result = await runAbandonedCheckoutSweep(app.getDb(), app.log);
    return reply.send({
      ok: true,
      flaggedCount: result.flagged.length,
      recoveredByReverifyCount: result.recoveredByReverify.length,
    });
  });
}
