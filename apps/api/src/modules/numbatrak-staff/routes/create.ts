import type { FastifyInstance } from "fastify";
import { createNumbatrakStaffRequestSchema } from "@platform/shared-types";
import { createStaff } from "../lib/staff.js";

export default async function createStaffRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/staff",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const body = createNumbatrakStaffRequestSchema.parse(request.body);
      const db = app.getDb();
      try {
        const staff = await createStaff(db, request.activeOrganizationId!, body);
        return reply.code(201).send(staff);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed to create staff record" });
      }
    },
  );
}
