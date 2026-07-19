import { sql, eq, gte, and } from "drizzle-orm";
import { userActivityDays, type Database } from "@platform/db";

/** Formats a Date as a UTC YYYY-MM-DD calendar day. */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Records that a user was active today. Idempotent per (user, day): the first
 * hit of the day inserts, subsequent hits only bump last_seen_at. Best-effort —
 * callers should swallow errors so activity tracking never breaks a request.
 */
export async function recordUserActivity(
  db: Database,
  userId: string,
  organizationId: string | null,
  now: Date,
): Promise<void> {
  const activityDate = toDateString(now);
  await db
    .insert(userActivityDays)
    .values({ userId, organizationId, activityDate, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [userActivityDays.userId, userActivityDays.activityDate],
      set: { lastSeenAt: now, organizationId },
    });
}

export interface DauMau {
  dau: number;
  mau: number;
  ratio: number | null;
  uniqueActiveToday: number;
}

/**
 * DAU = distinct users active today. MAU = distinct users active in the
 * trailing 30 days. ratio = DAU/MAU (stickiness), null when MAU is 0.
 * Because (user_id, activity_date) is unique, a row count for a day already
 * equals the distinct-user count for that day.
 */
export async function getDauMau(db: Database, now: Date): Promise<DauMau> {
  const today = toDateString(now);
  const windowStart = toDateString(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));

  const [dauRow] = await db
    .select({ dau: sql<number>`count(*)::int` })
    .from(userActivityDays)
    .where(eq(userActivityDays.activityDate, today));

  const [mauRow] = await db
    .select({ mau: sql<number>`count(distinct ${userActivityDays.userId})::int` })
    .from(userActivityDays)
    .where(gte(userActivityDays.activityDate, windowStart));

  const dau = dauRow?.dau ?? 0;
  const mau = mauRow?.mau ?? 0;
  return {
    dau,
    mau,
    ratio: mau > 0 ? dau / mau : null,
    uniqueActiveToday: dau,
  };
}
