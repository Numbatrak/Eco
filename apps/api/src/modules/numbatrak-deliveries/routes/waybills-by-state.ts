import type { FastifyInstance } from "fastify";
import { numbatrakWaybillsByStateQuerySchema } from "@platform/shared-types";
import { fetchWaybillsByState } from "../lib/waybills-by-state.js";

export default async function waybillsByStateRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/deliveries/waybills-by-state",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["view"] }) },
    async (request, reply) => {
      const query = numbatrakWaybillsByStateQuerySchema.parse(request.query);
      const db = app.getDb();
      const states = await fetchWaybillsByState(db, request.activeOrganizationId!, query);
      return reply.send({ states });
    },
  );
}
