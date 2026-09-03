import { and, eq, desc, inArray, gte, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import {
  numbatrakStrikeSettings,
  numbatrakStrikes,
  numbatrakStaff,
  member,
  user,
  type Database,
} from "@platform/db";
import type { NumbatrakStrikeSettings, NumbatrakStrike } from "@platform/shared-types";
import { sendEmail } from "../../auth/lib/email.js";
import { strikeIssuedEmail, strikeThresholdReachedEmail } from "../../../lib/email-templates.js";
import type { CallerStaffScope } from "../../numbatrak-staff/lib/staff.js";

type SettingsRow = typeof numbatrakStrikeSettings.$inferSelect;
type StrikeRow = typeof numbatrakStrikes.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakStrikeSettings {
  return {
    id: row.id,
    threshold: row.threshold,
    thresholdPeriod: row.thresholdPeriod as NumbatrakStrikeSettings["thresholdPeriod"],
    consequence: row.consequence,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeStrike(
  row: StrikeRow,
  staffName: string | null,
  issuedByName: string | null,
  thresholdReached: boolean,
): NumbatrakStrike {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName,
    reason: row.reason,
    issuedBy: row.issuedBy,
    issuedByName,
    issuedAt: row.issuedAt?.toISOString() ?? "",
    cleared: row.cleared,
    clearedBy: row.clearedBy,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    thresholdReached,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (period === "quarter") return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Active (uncleared) strike count for a set of staff, issued within the current threshold period. */
async function countActiveStrikesByStaff(
  db: Database,
  organizationId: string,
  staffIds: string[],
  periodStart: Date,
): Promise<Map<string, number>> {
  if (staffIds.length === 0) return new Map();
  const rows = await db
    .select({ staffId: numbatrakStrikes.staffId, count: sql<number>`count(*)::int` })
    .from(numbatrakStrikes)
    .where(
      and(
        eq(numbatrakStrikes.organizationId, organizationId),
        eq(numbatrakStrikes.cleared, false),
        inArray(numbatrakStrikes.staffId, staffIds),
        gte(numbatrakStrikes.issuedAt, periodStart),
      ),
    )
    .groupBy(numbatrakStrikes.staffId);
  return new Map(rows.map((r) => [r.staffId, r.count]));
}

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakStrikeSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakStrikeSettings)
    .where(eq(numbatrakStrikeSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serializeSettings(existing);

  const [row] = await db
    .insert(numbatrakStrikeSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: { threshold?: number; thresholdPeriod?: string; consequence?: string },
): Promise<NumbatrakStrikeSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakStrikeSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.threshold !== undefined) values.threshold = input.threshold;
  if (input.thresholdPeriod !== undefined) values.thresholdPeriod = input.thresholdPeriod;
  if (input.consequence !== undefined) values.consequence = input.consequence;

  const [row] = await db
    .update(numbatrakStrikeSettings)
    .set(values)
    .where(eq(numbatrakStrikeSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

export async function listStrikes(db: Database, organizationId: string, scope: CallerStaffScope): Promise<NumbatrakStrike[]> {
  const conditions = [eq(numbatrakStrikes.organizationId, organizationId)];
  if (!scope.all) conditions.push(inArray(numbatrakStrikes.staffId, scope.staffIds));

  const rows = await db
    .select({
      strike: numbatrakStrikes,
      staffName: user.name,
    })
    .from(numbatrakStrikes)
    .innerJoin(numbatrakStaff, eq(numbatrakStrikes.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(numbatrakStrikes.issuedAt));

  const settings = await getOrCreateSettings(db, organizationId);
  const periodStart = getPeriodStart(settings.thresholdPeriod);
  const staffIds = [...new Set(rows.map((r) => r.strike.staffId))];
  const counts = await countActiveStrikesByStaff(db, organizationId, staffIds, periodStart);

  const result: NumbatrakStrike[] = [];
  for (const row of rows) {
    let issuedByName: string | null = null;
    if (row.strike.issuedBy) {
      const [issuer] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.strike.issuedBy)).limit(1);
      issuedByName = issuer?.name ?? null;
    }
    const thresholdReached = (counts.get(row.strike.staffId) ?? 0) >= settings.threshold;
    result.push(serializeStrike(row.strike, row.staffName, issuedByName, thresholdReached));
  }
  return result;
}

export async function issueStrikes(
  db: Database,
  logger: FastifyBaseLogger,
  organizationId: string,
  staffIds: string[],
  reason: string,
  issuedBy: string,
  scope: CallerStaffScope,
): Promise<NumbatrakStrike[]> {
  // "Managers issue to their team" (LOCKED RULE) - a manager can't target
  // staff outside their direct reports; admin/owner are unrestricted.
  if (!scope.all) {
    const outsideTeam = staffIds.filter((id) => !scope.staffIds.includes(id));
    if (outsideTeam.length > 0) {
      throw new Error("You can only issue strikes to your own team.");
    }
  }

  const settings = await getOrCreateSettings(db, organizationId);
  const periodStart = getPeriodStart(settings.thresholdPeriod);

  const results: NumbatrakStrike[] = [];
  for (const staffId of staffIds) {
    const [row] = await db
      .insert(numbatrakStrikes)
      .values({ organizationId, staffId, reason, issuedBy })
      .returning();

    const counts = await countActiveStrikesByStaff(db, organizationId, [staffId], periodStart);
    const thresholdReached = (counts.get(staffId) ?? 0) >= settings.threshold;
    results.push(serializeStrike(row!, null, null, thresholdReached));

    const [staffUser] = await db
      .select({ name: user.name, email: user.email })
      .from(numbatrakStaff)
      .innerJoin(user, eq(numbatrakStaff.userId, user.id))
      .where(eq(numbatrakStaff.id, staffId))
      .limit(1);

    // "Issuing notifies the staff member through the shared notification
    // layer" (LOCKED RULE) - that layer doesn't exist yet, so email covers
    // the "must not be missed" part in the meantime, same as Payroll/Wallet.
    try {
      if (staffUser) {
        await sendEmail(logger, {
          to: staffUser.email,
          subject: "A strike has been recorded against your record",
          body: strikeIssuedEmail({ staffName: staffUser.name, reason }),
        });
      }
    } catch (err) {
      logger.warn({ err, staffId }, "Failed to send strike notification email");
    }

    // Threshold hit -> the configured consequence (e.g. "HR review") needs
    // following up on, so email everyone who can act on it.
    if (thresholdReached) {
      try {
        const managers = await db
          .select({ email: user.email })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(and(eq(member.organizationId, organizationId), inArray(member.role, ["owner", "admin", "manager"])));
        const body = strikeThresholdReachedEmail({
          staffName: staffUser?.name ?? "A staff member",
          threshold: settings.threshold,
          thresholdPeriod: settings.thresholdPeriod,
          consequence: settings.consequence,
        });
        for (const m of managers) {
          await sendEmail(logger, { to: m.email, subject: `Strike threshold reached — ${staffUser?.name ?? "a staff member"}`, body });
        }
      } catch (err) {
        logger.warn({ err, staffId }, "Failed to send strike threshold notification email");
      }
    }
  }
  return results;
}

export async function clearStrike(
  db: Database,
  organizationId: string,
  strikeId: string,
  clearedBy: string,
): Promise<NumbatrakStrike | null> {
  const [row] = await db
    .update(numbatrakStrikes)
    .set({ cleared: true, clearedBy, clearedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(numbatrakStrikes.id, strikeId), eq(numbatrakStrikes.organizationId, organizationId)))
    .returning();
  if (!row) return null;
  return serializeStrike(row, null, null, false);
}
