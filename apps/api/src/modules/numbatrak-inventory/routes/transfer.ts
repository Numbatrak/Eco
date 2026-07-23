import type { FastifyInstance } from "fastify";
import { createNumbatrakTransferMovementRequestSchema } from "@platform/shared-types";
import { createTransfer } from "../lib/movements.js";

export default async function transferMovementRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/inventory/transfer",
    { preHandler: app.requireOrgPermission({ numbatrakInventory: ["manage"] }) },
    async (request, reply) => {
      const body = createNumbatrakTransferMovementRequestSchema.parse(request.body);
      const db = app.getDb();
      try {
        const movement = await createTransfer(db, request.activeOrganizationId!, body);
        return reply.code(201).send(movement);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Transfer failed" });
      }
    },
  );
}
