import type { FastifyInstance } from "fastify";
import { removeDelivery } from "../lib/deliveries.js";

export default async function deleteDeliveryRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { deliveryId: string } }>(
    "/org/numbatrak/deliveries/:deliveryId",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deliveryId = Number(request.params.deliveryId);
      const deleted = await removeDelivery(db, request.activeOrganizationId!, deliveryId);
      if (!deleted) {
        return reply.code(404).send({ error: "Delivery not found" });
      }
      return reply.code(204).send();
    },
  );
}
