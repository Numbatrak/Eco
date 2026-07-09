import type { FastifyInstance } from "fastify";
import { inArray, eq, and } from "drizzle-orm";
import { member as memberTable } from "@platform/db";
import type { MeResponse, OrgRole } from "@platform/shared-types";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/me", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });
    if (!session) {
      return reply.code(401).send({ error: "Not authenticated" });
    }

    const organizations = await auth.api.listOrganizations({ headers });
    const db = app.getDb();
    const memberships =
      organizations.length > 0
        ? await db
            .select({ organizationId: memberTable.organizationId, role: memberTable.role })
            .from(memberTable)
            .where(
              and(
                eq(memberTable.userId, session.user.id),
                inArray(
                  memberTable.organizationId,
                  organizations.map((org) => org.id),
                ),
              ),
            )
        : [];
    const roleByOrgId = new Map(memberships.map((m) => [m.organizationId, m.role as OrgRole]));

    const response: MeResponse = {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified,
        twoFactorEnabled: Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
      },
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: roleByOrgId.get(org.id) ?? "viewer",
      })),
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    };
    return reply.send(response);
  });
}
