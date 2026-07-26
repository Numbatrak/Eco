import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { updateStaff } from "../lib/staff.js";

const setActiveSchema = z.object({ active: z.boolean() });

/**
 * Deactivate-only, no hard delete - bank details on a staff record will feed
 * a future Payroll payment run, so removing the row outright risks orphaning
 * that history once Payroll ships. Matches Agents' soft-deactivate precedent
 * (numbatrakAgents.active) rather than Agents' separate hard-delete route.
 */
export default async function setStaffActiveRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { staffId: string } }>(
    "/org/numbatrak/staff/:staffId/active",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const body = setActiveSchema.parse(request.body);
      const db = app.getDb();
      const staff = await updateStaff(db, request.activeOrganizationId!, request.params.staffId, {
        active: body.active,
      });
      if (!staff) {
        return reply.code(404).send({ error: "Staff record not found" });
      }
      return reply.send(staff);
    },
  );
}
