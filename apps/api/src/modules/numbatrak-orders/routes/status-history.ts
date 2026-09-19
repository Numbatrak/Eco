import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { numbatrakOrderStatusHistory, user, type Database } from "@platform/db";

async function listStatusHistory(db: Database, organizationId: string, orderId: string) {
  const rows = await db
    .select()
    .from(numbatrakOrderStatusHistory)
    .where(
      and(
        eq(numbatrakOrderStatusHistory.organizationId, organizationId),
        eq(numbatrakOrderStatusHistory.orderId, orderId),
      ),
    )
    .orderBy(desc(numbatrakOrderStatusHistory.createdAt));

  const userIds = [...new Set(rows.map((r) => r.changedBy).filter((id): id is string => id != null))];
  const userMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const users = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds));
    for (const u of users) userMap.set(u.id, u.name);
  }

  return rows.map((r) => ({
    id: r.id,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    changedByName: r.changedBy ? (userMap.get(r.changedBy) ?? null) : null,
    createdAt: r.createdAt?.toISOString() ?? null,
  }));
}

export default async function orderStatusHistoryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { orderId: string } }>(
    "/org/numbatrak/orders/:orderId/status-history",
    { preHandler: app.requireOrgPermission({ numbatrakOrders: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const history = await listStatusHistory(db, request.activeOrganizationId!, request.params.orderId);
      return reply.send({ history });
    },
  );
}
