import type { FastifyInstance } from "fastify";
import { listPlatformPlans, findPlatformPlan } from "../lib/platform-plans-store.js";

export default async function platformPlansRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/platform-admin/billing/plans",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const plans = await listPlatformPlans(app.getDb());
      return reply.send({ plans });
    },
  );

  app.get<{ Params: { planId: string } }>(
    "/platform-admin/billing/plans/:planId",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const plan = await findPlatformPlan(app.getDb(), request.params.planId);
      if (!plan) return reply.code(404).send({ error: "plan_not_found" });
      return reply.send({ plan });
    },
  );
}
