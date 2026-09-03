import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { createNumbatrakWaybillBatchRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { createWaybillBatch } from "../lib/waybills.js";

export default async function waybillBatchRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/deliveries/waybill-batch",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakWaybillBatchRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let deliveries;
      try {
        deliveries = await createWaybillBatch(db, request.activeOrganizationId!, body, session?.user.id ?? null);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Waybill intake failed" });
      }
      return reply.code(201).send({ deliveries });
    },
  );
}
