// Server-side port of src/services/followUps.ts's autoAssignFollowUp, and
// the DB trigger pick_csr_for_follow_up() that the source app's Postgres
// side used to auto-create a follow-up on every abandoned-cart insert
// (supabase/migrations/20260720200000_follow_up_stabilization.sql). Both use
// the same "least busy" rule and the same active-status bucket, so one
// function serves both callers (numbatrak-follow-ups' createFollowUp, and
// numbatrak-abandoned-carts' createCart auto-trigger retrofit).
import { and, eq, inArray, sql } from "drizzle-orm";
import { member, numbatrakFollowUps, type Database } from "@platform/db";

const ACTIVE_STATUSES = ["awaiting", "followed_up"];

export async function pickLeastBusyCsr(db: Database, organizationId: string): Promise<string | null> {
  const csrMembers = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "csr")));
  if (csrMembers.length === 0) return null;

  const workloadRows = await db
    .select({ userId: numbatrakFollowUps.assignedTo, count: sql<number>`count(*)::int` })
    .from(numbatrakFollowUps)
    .where(
      and(
        eq(numbatrakFollowUps.organizationId, organizationId),
        inArray(
          numbatrakFollowUps.assignedTo,
          csrMembers.map((m) => m.userId),
        ),
        inArray(numbatrakFollowUps.status, ACTIVE_STATUSES),
      ),
    )
    .groupBy(numbatrakFollowUps.assignedTo);

  const workloadByUser = new Map(workloadRows.map((r) => [r.userId, r.count]));
  const ranked = csrMembers
    .map((m) => ({ userId: m.userId, workload: workloadByUser.get(m.userId) ?? 0 }))
    .sort((a, b) => a.workload - b.workload);

  return ranked[0]?.userId ?? null;
}
