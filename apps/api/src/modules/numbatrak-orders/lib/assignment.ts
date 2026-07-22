// Server-side port of the source app's get_next_round_robin_user /
// get_percentage_assigned_user / pick_csr_for_order_assignment Postgres RPCs
// (supabase/migrations/20260720230000_order_assignment_stabilization.sql),
// called directly from the browser in the source app - there's no RPC to
// call anymore, so this logic now lives here instead.
//
// Candidate pool = org `member` rows with role = 'csr' (source used
// organization_members.role = 'Customer Relations'), excluding paused
// weights. Ordering is by user id (a stable but not otherwise meaningful
// rotation order, same as the source).
import { and, asc, eq, sql } from "drizzle-orm";
import { member, numbatrakOrderAssignmentSettings, numbatrakOrderAssignmentWeights, type Queryable } from "@platform/db";

async function csrCandidatePool(
  db: Queryable,
  organizationId: string,
): Promise<{ userId: string; percentage: string | null; isPaused: boolean }[]> {
  const rows = await db
    .select({
      userId: member.userId,
      percentage: numbatrakOrderAssignmentWeights.percentage,
      isPaused: numbatrakOrderAssignmentWeights.isPaused,
    })
    .from(member)
    .leftJoin(
      numbatrakOrderAssignmentWeights,
      and(
        eq(numbatrakOrderAssignmentWeights.organizationId, organizationId),
        eq(numbatrakOrderAssignmentWeights.userId, member.userId),
      ),
    )
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "csr")))
    .orderBy(asc(member.userId));
  return rows.map((r) => ({ userId: r.userId, percentage: r.percentage, isPaused: r.isPaused ?? false }));
}

async function getNextRoundRobinUser(db: Queryable, organizationId: string): Promise<string | null> {
  const [settings] = await db
    .select({ lastAssignedUserId: numbatrakOrderAssignmentSettings.lastAssignedUserId })
    .from(numbatrakOrderAssignmentSettings)
    .where(eq(numbatrakOrderAssignmentSettings.organizationId, organizationId))
    .limit(1);
  const lastAssignedUserId = settings?.lastAssignedUserId ?? null;

  const pool = (await csrCandidatePool(db, organizationId)).filter((c) => !c.isPaused);
  if (pool.length === 0) return null;

  const next =
    (lastAssignedUserId ? pool.find((c) => c.userId > lastAssignedUserId) : undefined) ?? pool[0];
  if (!next) return null;

  await db
    .insert(numbatrakOrderAssignmentSettings)
    .values({ organizationId, assignmentMethod: "round_robin", lastAssignedUserId: next.userId })
    .onConflictDoUpdate({
      target: numbatrakOrderAssignmentSettings.organizationId,
      set: { lastAssignedUserId: next.userId, updatedAt: sql`now()` },
    });

  return next.userId;
}

async function getPercentageAssignedUser(db: Queryable, organizationId: string): Promise<string | null> {
  const pool = (await csrCandidatePool(db, organizationId)).filter(
    (c) => !c.isPaused && c.percentage != null && Number(c.percentage) > 0,
  );
  const total = pool.reduce((sum, c) => sum + Number(c.percentage), 0);
  if (total <= 0) return getNextRoundRobinUser(db, organizationId);

  let cumulative = 0;
  const roll = Math.random() * total;
  for (const candidate of pool) {
    cumulative += Number(candidate.percentage);
    if (roll <= cumulative) return candidate.userId;
  }
  return pool[pool.length - 1]?.userId ?? null;
}

/** Auto-assign the next CSR for a new order, per the org's assignment_method (default round_robin). */
export async function getNextAssignedUser(db: Queryable, organizationId: string): Promise<string | null> {
  const [settings] = await db
    .select({ assignmentMethod: numbatrakOrderAssignmentSettings.assignmentMethod })
    .from(numbatrakOrderAssignmentSettings)
    .where(eq(numbatrakOrderAssignmentSettings.organizationId, organizationId))
    .limit(1);

  if (!settings || settings.assignmentMethod === "round_robin") {
    return getNextRoundRobinUser(db, organizationId);
  }
  return getPercentageAssignedUser(db, organizationId);
}
