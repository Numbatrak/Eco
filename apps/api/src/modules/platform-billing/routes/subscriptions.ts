import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  findSubscriptionByOrg,
  createSubscription,
  cancelSubscription,
} from "../lib/platform-subscriptions-store.js";
import { findPlatformPlan } from "../lib/platform-plans-store.js";
import { getCreditBalances } from "../lib/platform-credit-ledger.js";

const createSubscriptionBody = z.object({
  planId: z.string().uuid(),
  billingInterval: z.enum(["monthly", "annual"]).default("monthly"),
  paystackSubscriptionCode: z.string().optional(),
  paystackCustomerCode: z.string().optional(),
  trialDays: z.number().int().min(0).max(30).optional(),
});

export default async function platformSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET — subscription + credit balance for a tenant
  app.get<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/billing",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      const [subscription, credits] = await Promise.all([
        findSubscriptionByOrg(db, tenantId),
        getCreditBalances(db, tenantId),
      ]);
      return reply.send({ subscription, credits });
    },
  );

  // POST — provision a subscription for a tenant
  app.post<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/billing/subscription",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      const body = createSubscriptionBody.parse(request.body);

      const plan = await findPlatformPlan(db, body.planId);
      if (!plan) return reply.code(404).send({ error: "plan_not_found" });

      const existing = await findSubscriptionByOrg(db, tenantId);
      if (existing) return reply.code(409).send({ error: "subscription_already_exists" });

      const now = new Date();
      const periodEnd = new Date(now);
      if (body.billingInterval === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const trialEndsAt =
        body.trialDays && body.trialDays > 0
          ? new Date(now.getTime() + body.trialDays * 24 * 60 * 60 * 1000)
          : undefined;

      const subscription = await createSubscription(db, {
        organizationId: tenantId,
        planId: body.planId,
        billingInterval: body.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        paystackSubscriptionCode: body.paystackSubscriptionCode,
        paystackCustomerCode: body.paystackCustomerCode,
      });

      return reply.code(201).send({ subscription });
    },
  );

  // DELETE — cancel a subscription
  app.delete<{ Params: { tenantId: string } }>(
    "/platform-admin/tenants/:tenantId/billing/subscription",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { tenantId } = request.params;
      const existing = await findSubscriptionByOrg(db, tenantId);
      if (!existing) return reply.code(404).send({ error: "subscription_not_found" });
      await cancelSubscription(db, tenantId);
      return reply.code(204).send();
    },
  );
}
