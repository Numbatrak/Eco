import type { FastifyInstance } from "fastify";
import { createNumbatrakWaybillBatchRequestSchema } from "@platform/shared-types";
import { createWaybillBatch } from "../lib/waybills.js";

export default async function waybillBatchRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/deliveries/waybill-batch",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakWaybillBatchRequestSchema.parse(request.body);
      const db = app.getDb();
      let deliveries;
      try {
        deliveries = await createWaybillBatch(db, request.activeOrganizationId!, body);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Waybill intake failed" });
      }
      return reply.code(201).send({ deliveries });
    },
  );
}
