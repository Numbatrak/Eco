import type { FastifyInstance } from "fastify";
import { updateNumbatrakDeliveryRequestSchema } from "@platform/shared-types";
import { updateDelivery } from "../lib/deliveries.js";

export default async function updateDeliveryRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { deliveryId: string } }>(
    "/org/numbatrak/deliveries/:deliveryId",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakDeliveryRequestSchema.parse(request.body);
      const db = app.getDb();
      const deliveryId = Number(request.params.deliveryId);
      const delivery = await updateDelivery(db, request.activeOrganizationId!, deliveryId, body);
      if (!delivery) {
        return reply.code(404).send({ error: "Delivery not found" });
      }
      return reply.send(delivery);
    },
  );
}
