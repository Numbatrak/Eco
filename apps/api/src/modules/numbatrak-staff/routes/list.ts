import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { member } from "@platform/db";
import { auth } from "../../../lib/auth.js";
import { listStaffForOrg, type StaffListScope } from "../lib/staff.js";

const BROAD_VISIBILITY_ROLES = new Set(["owner", "admin", "manager"]);

export default async function listStaffRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/staff",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;

      // Role-scoping per the Feature Spec's locked rule ("admins see all
      // staff, managers see their team, everyone sees their own record") -
      // "team" has no defined reporting hierarchy anywhere in the schema yet,
      // so manager is treated as org-wide for now, mirroring the same
      // simplification already documented for Orders/Dashboard data scope.
      // Same session-refetch pattern as numbatrak-orders/routes/list.ts's
      // csrScopeUserId.
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let scope: StaffListScope = { all: true };
      if (session) {
        const [membership] = await db
          .select({ role: member.role })
          .from(member)
          .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
          .limit(1);
        if (!membership || !BROAD_VISIBILITY_ROLES.has(membership.role)) {
          scope = { all: false, ownUserId: session.user.id };
        }
      }

      const staff = await listStaffForOrg(db, organizationId, scope);
      return reply.send({ staff });
    },
  );
}
