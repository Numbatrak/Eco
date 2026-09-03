import type { FastifyInstance } from "fastify";
import { upsertNumbatrakDeliveryFeeRuleRequestSchema } from "@platform/shared-types";
import { listDeliveryFeeRules, upsertDeliveryFeeRule, deleteDeliveryFeeRule } from "../lib/delivery-fees.js";

export default async function numbatrakDeliveryFeesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/delivery-fee-rules",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveryFees: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const rules = await listDeliveryFeeRules(db, organizationId);
      return reply.send({ rules });
    },
  );

  app.post(
    "/org/numbatrak/delivery-fee-rules",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveryFees: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = upsertNumbatrakDeliveryFeeRuleRequestSchema.parse(request.body);
      const rule = await upsertDeliveryFeeRule(db, organizationId, body);
      return reply.status(201).send(rule);
    },
  );

  app.delete(
    "/org/numbatrak/delivery-fee-rules/:ruleId",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveryFees: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { ruleId } = request.params as { ruleId: string };
      const ok = await deleteDeliveryFeeRule(db, organizationId, ruleId);
      if (!ok) return reply.status(404).send({ error: "Rule not found" });
      return reply.send({ success: true });
    },
  );
}
