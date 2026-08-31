import type { FastifyInstance } from "fastify";
import { deliveryZoneRatesRequestSchema, type DeliveryZoneRatesResponse } from "@platform/shared-types";
import { listZoneRates, replaceZoneRates, serializeZoneRate } from "../lib/delivery-zone-store.js";

export default async function deliveryZoneRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/delivery-zones",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listZoneRates(db, request.activeOrganizationId!);
      const response: DeliveryZoneRatesResponse = { rates: rows.map(serializeZoneRate) };
      return reply.send(response);
    },
  );

  app.put(
    "/org/delivery-zones",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = deliveryZoneRatesRequestSchema.parse(request.body);
      const db = app.getDb();
      const rows = await replaceZoneRates(db, request.activeOrganizationId!, body.rates);
      const response: DeliveryZoneRatesResponse = { rates: rows.map(serializeZoneRate) };
      return reply.send(response);
    },
  );
}
