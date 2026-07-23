import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { addNumbatrakOrderUpsellRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { addOrderUpsellLine } from "../lib/orders.js";

export default async function addOrderUpsellRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/upsell",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["update"] }) },
    async (request, reply) => {
      const body = addNumbatrakOrderUpsellRequestSchema.parse(request.body);
      const db = app.getDb();
      // Whoever is authenticated when the upsell is added gets the payroll
      // credit for it (see lib/orders.ts's addOrderUpsellLine) - same
      // session-refetch pattern used in numbatrak-orders/routes/list.ts's
      // csrScopeUserId and numbatrak-staff/routes/list.ts.
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let order;
      try {
        order = await addOrderUpsellLine(
          db,
          request.activeOrganizationId!,
          request.params.orderId,
          body,
          session?.user.id ?? null,
        );
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Add upsell failed" });
      }
      if (!order) {
        return reply.code(404).send({ error: "Order not found" });
      }
      return reply.send(order);
    },
  );
}
