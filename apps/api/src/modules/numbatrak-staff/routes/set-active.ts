import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "../../../lib/auth.js";
import { updateStaff } from "../lib/staff.js";

const setActiveSchema = z.object({ active: z.boolean() });

/**
 * Deactivate-only, no hard delete - bank details on a staff record will feed
 * a future Payroll payment run, so removing the row outright risks orphaning
 * that history once Payroll ships. Matches Agents' soft-deactivate precedent
 * (numbatrakAgents.active) rather than Agents' separate hard-delete route.
 * Also keeps `employmentStatus` in lockstep with this boolean (active/
 * inactive) - the finer-grained suspended/on_leave states are only reachable
 * through the full staff-edit form, not this quick toggle.
 */
export default async function setStaffActiveRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { staffId: string } }>(
    "/org/numbatrak/staff/:staffId/active",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const body = setActiveSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      const staff = await updateStaff(
        db,
        request.activeOrganizationId!,
        request.params.staffId,
        { active: body.active, employmentStatus: body.active ? "active" : "inactive" },
        session?.user.id ?? null,
      );
      if (!staff) {
        return reply.code(404).send({ error: "Staff record not found" });
      }
      return reply.send(staff);
    },
  );
}
