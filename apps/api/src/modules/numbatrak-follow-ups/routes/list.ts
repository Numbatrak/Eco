import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { listNumbatrakFollowUpsQuerySchema } from "@platform/shared-types";
import { member } from "@platform/db";
import { auth } from "../../../lib/auth.js";
import { listFollowUpsForOrg } from "../lib/follow-ups.js";

export default async function listFollowUpsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/follow-ups",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakFollowUpsQuerySchema.parse(request.query);
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;

      // CSR row-scoping mirrors numbatrak-orders/routes/list.ts's own
      // csrScopeUserId pattern - a csr only ever sees follow-ups assigned to
      // them, regardless of any assignedTo filter they pass.
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let effectiveQuery = query;
      if (session) {
        const [membership] = await db
          .select({ role: member.role })
          .from(member)
          .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
          .limit(1);
        if (membership?.role === "csr") {
          effectiveQuery = { ...query, assignedTo: session.user.id };
        }
      }

      const followUps = await listFollowUpsForOrg(db, organizationId, effectiveQuery);
      return reply.send({ followUps });
    },
  );
}
