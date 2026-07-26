import { and, eq, desc } from "drizzle-orm";
import {
  numbatrakStrikeSettings,
  numbatrakStrikes,
  numbatrakStaff,
  user,
  type Database,
} from "@platform/db";
import type { NumbatrakStrikeSettings, NumbatrakStrike } from "@platform/shared-types";

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

function serializeStrike(row: StrikeRow, staffName: string | null, issuedByName: string | null): NumbatrakStrike {
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
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
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

export async function listStrikes(db: Database, organizationId: string): Promise<NumbatrakStrike[]> {
  const rows = await db
    .select({
      strike: numbatrakStrikes,
      staffName: user.name,
    })
    .from(numbatrakStrikes)
    .innerJoin(numbatrakStaff, eq(numbatrakStrikes.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(eq(numbatrakStrikes.organizationId, organizationId))
    .orderBy(desc(numbatrakStrikes.issuedAt));

  const result: NumbatrakStrike[] = [];
  for (const row of rows) {
    let issuedByName: string | null = null;
    if (row.strike.issuedBy) {
      const [issuer] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.strike.issuedBy)).limit(1);
      issuedByName = issuer?.name ?? null;
    }
    result.push(serializeStrike(row.strike, row.staffName, issuedByName));
  }
  return result;
}

export async function issueStrikes(
  db: Database,
  organizationId: string,
  staffIds: string[],
  reason: string,
  issuedBy: string,
): Promise<NumbatrakStrike[]> {
  const results: NumbatrakStrike[] = [];
  for (const staffId of staffIds) {
    const [row] = await db
      .insert(numbatrakStrikes)
      .values({ organizationId, staffId, reason, issuedBy })
      .returning();
    results.push(serializeStrike(row!, null, null));
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
  return serializeStrike(row, null, null);
}
