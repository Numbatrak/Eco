import type { FastifyInstance } from "fastify";
import { confirmWaybillPickup } from "../lib/waybills.js";

/**
 * Staff/CSR-triggered confirmation that an agent has actually picked up a
 * waybilled line (e.g. after a phone/WhatsApp check-in) - the delivery agent
 * itself doesn't call this. Deliberately a dedicated endpoint rather than
 * folding into the generic PATCH /:deliveryId (update.ts), which is
 * documented as metadata-only with no stock-ledger side effects - this one
 * has a real side effect (crediting the agent's stock) and should stay an
 * explicit, auditable action.
 */
export default async function confirmWaybillPickupRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { deliveryId: string } }>(
    "/org/numbatrak/deliveries/:deliveryId/confirm-pickup",
    { preHandler: app.requireOrgPermission({ numbatrakDeliveries: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deliveryId = Number(request.params.deliveryId);
      try {
        const delivery = await confirmWaybillPickup(db, request.activeOrganizationId!, deliveryId);
        return reply.send(delivery);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed to confirm pickup" });
      }
    },
  );
}
