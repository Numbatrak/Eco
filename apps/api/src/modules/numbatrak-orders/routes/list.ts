import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { listNumbatrakOrdersQuerySchema } from "@platform/shared-types";
import { member } from "@platform/db";
import { auth } from "../../../lib/auth.js";
import { listOrdersForOrg } from "../lib/orders.js";

export default async function listOrdersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/orders",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakOrdersQuerySchema.parse(request.query);
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;

      // CSR row-level scoping: a csr-role member only ever sees their own
      // assigned orders, regardless of any csrId query param they send -
      // mirrors the source app's utils/specRoles.ts csrScopeFilter().
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      let csrScopeUserId: string | undefined;
      if (session) {
        const [membership] = await db
          .select({ role: member.role })
          .from(member)
          .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
          .limit(1);
        if (membership?.role === "csr") {
          csrScopeUserId = session.user.id;
        }
      }

      const orders = await listOrdersForOrg(db, organizationId, query, csrScopeUserId);
      return reply.send({ orders });
    },
  );
}
