import type { FastifyInstance } from "fastify";
import { receiveNumbatrakInventoryStockRequestSchema } from "@platform/shared-types";
import { receiveStock } from "../lib/inventory-lots.js";

export default async function numbatrakReceiveStockRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { productId: string } }>(
    "/org/numbatrak/products/:productId/receive-stock",
    { preHandler: app.requireOrgPermission({ numbatrakProducts: ["update"] }) },
    async (request, reply) => {
      const body = receiveNumbatrakInventoryStockRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await receiveStock(db, request.activeOrganizationId!, request.params.productId, body);
      return reply.code(201).send({
        id: row.id,
        organizationId: row.organizationId,
        productId: row.productId,
        variantId: row.variantId,
        quantityRemaining: row.quantityRemaining,
        unitCost: row.unitCost,
        receivedAt: row.receivedAt.toISOString(),
      });
    },
  );
}
