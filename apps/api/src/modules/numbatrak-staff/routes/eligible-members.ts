import type { FastifyInstance } from "fastify";
import { listEligibleMembers } from "../lib/staff.js";

export default async function eligibleMembersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/staff/eligible-members",
    { preHandler: app.requireOrgPermission({ numbatrakStaff: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const members = await listEligibleMembers(db, request.activeOrganizationId!);
      return reply.send({ members });
    },
  );
}
