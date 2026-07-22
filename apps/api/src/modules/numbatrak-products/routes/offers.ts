import type { FastifyInstance } from "fastify";
import { createNumbatrakProductOfferRequestSchema, updateNumbatrakProductOfferRequestSchema } from "@platform/shared-types";
import { createOffer, removeOffer, updateOffer } from "../lib/offers.js";
import { serializeOffer } from "../lib/products.js";

export default async function numbatrakProductOfferRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { productId: string } }>(
    "/org/numbatrak/products/:productId/offers",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = createNumbatrakProductOfferRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createOffer(db, request.activeOrganizationId!, request.params.productId, body);
      return reply.code(201).send(serializeOffer(row));
    },
  );

  app.patch<{ Params: { offerId: string } }>(
    "/org/numbatrak/product-offers/:offerId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakProductOfferRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await updateOffer(db, request.activeOrganizationId!, request.params.offerId, body);
      if (!row) {
        return reply.code(404).send({ error: "Offer not found" });
      }
      return reply.send(serializeOffer(row));
    },
  );

  app.delete<{ Params: { offerId: string } }>(
    "/org/numbatrak/product-offers/:offerId",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeOffer(db, request.activeOrganizationId!, request.params.offerId);
      if (!deleted) {
        return reply.code(404).send({ error: "Offer not found" });
      }
      return reply.code(204).send();
    },
  );
}
