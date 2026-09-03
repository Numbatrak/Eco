import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import { listStaffForOrg, resolveCallerStaffScope, type StaffListScope } from "../lib/staff.js";

export default async function listStaffRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/staff",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;

      // Role-scoping per the Feature Spec's locked rule ("admins see all
      // staff, managers see their team, everyone sees their own record") -
      // "team" is the real reporting hierarchy (numbatrakStaff.managerId).
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let scope: StaffListScope = { all: false, staffIds: [] };
      if (session) {
        const resolved = await resolveCallerStaffScope(db, organizationId, session.user.id);
        scope = resolved.all ? { all: true } : { all: false, staffIds: resolved.staffIds };
      }

      const staff = await listStaffForOrg(db, organizationId, scope);
      return reply.send({ staff });
    },
  );
}
