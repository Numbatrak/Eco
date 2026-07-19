import type { FastifyInstance } from "fastify";
import { computeAndWriteTodaySnapshot } from "../lib/metrics/metric-snapshots-store.js";

/**
 * POST /platform-billing/cron/metrics-snapshot
 *
 * Writes today's platform_metric_snapshots row (idempotent per day). Run daily
 * — the snapshot series backs churn, NRR, and the Overview trend lines, which
 * need point-in-time history. Protected by the same X-Cron-Secret as the
 * dunning tick.
 */
export default async function metricsSnapshotCronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/platform-billing/cron/metrics-snapshot", async (request, reply) => {
    const secret = process.env.PLATFORM_CRON_SECRET;
    if (!secret) {
      app.log.error("PLATFORM_CRON_SECRET not set — metrics-snapshot cron is disabled");
      return reply.code(503).send({ error: "cron_not_configured" });
    }
    if (request.headers["x-cron-secret"] !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const snapshot = await computeAndWriteTodaySnapshot(app.getDb(), new Date());
    return reply.send({ ok: true, snapshotDate: snapshot.snapshotDate, mrrCents: snapshot.mrrCents });
  });
}
