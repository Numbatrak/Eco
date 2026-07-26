import type { FastifyInstance } from "fastify";
import { updateNumbatrakStaffRequestSchema } from "@platform/shared-types";
import { updateStaff } from "../lib/staff.js";

export default async function updateStaffRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { staffId: string } }>(
    "/org/numbatrak/staff/:staffId",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const body = updateNumbatrakStaffRequestSchema.parse(request.body);
      const db = app.getDb();
      try {
        const staff = await updateStaff(db, request.activeOrganizationId!, request.params.staffId, body);
        if (!staff) {
          return reply.code(404).send({ error: "Staff record not found" });
        }
        return reply.send(staff);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed to update staff record" });
      }
    },
  );
}
