import { and, eq, desc, sql, asc } from "drizzle-orm";
import {
  numbatrakStarSettings,
  numbatrakStarTiers,
  numbatrakStars,
  numbatrakStaff,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakStarSettings,
  NumbatrakStarTier,
  NumbatrakStar,
  NumbatrakLeaderboardEntry,
} from "@platform/shared-types";

type SettingsRow = typeof numbatrakStarSettings.$inferSelect;
type TierRow = typeof numbatrakStarTiers.$inferSelect;
type StarRow = typeof numbatrakStars.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakStarSettings {
  return {
    id: row.id,
    enabled: row.enabled,
    sotmEnabled: row.sotmEnabled,
    sotmCriteria: row.sotmCriteria as NumbatrakStarSettings["sotmCriteria"],
    sotmMinStarTier: row.sotmMinStarTier,
    sotmWinnerCount: row.sotmWinnerCount,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeTier(row: TierRow): NumbatrakStarTier {
  return {
    id: row.id,
    name: row.name,
    minPoints: row.minPoints,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeStar(row: StarRow, staffName: string | null, awardedByName: string | null): NumbatrakStar {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName,
    points: row.points,
    reason: row.reason,
    awardedBy: row.awardedBy,
    awardedByName,
    awardedAt: row.awardedAt?.toISOString() ?? "",
    month: row.month,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakStarSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakStarSettings)
    .where(eq(numbatrakStarSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serializeSettings(existing);

  const [row] = await db
    .insert(numbatrakStarSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: {
    enabled?: boolean;
    sotmEnabled?: boolean;
    sotmCriteria?: string;
    sotmMinStarTier?: number;
    sotmWinnerCount?: number;
  },
): Promise<NumbatrakStarSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakStarSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.enabled !== undefined) values.enabled = input.enabled;
  if (input.sotmEnabled !== undefined) values.sotmEnabled = input.sotmEnabled;
  if (input.sotmCriteria !== undefined) values.sotmCriteria = input.sotmCriteria;
  if (input.sotmMinStarTier !== undefined) values.sotmMinStarTier = input.sotmMinStarTier;
  if (input.sotmWinnerCount !== undefined) values.sotmWinnerCount = input.sotmWinnerCount;

  const [row] = await db
    .update(numbatrakStarSettings)
    .set(values)
    .where(eq(numbatrakStarSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

export async function listTiers(db: Database, organizationId: string): Promise<NumbatrakStarTier[]> {
  const rows = await db
    .select()
    .from(numbatrakStarTiers)
    .where(eq(numbatrakStarTiers.organizationId, organizationId))
    .orderBy(asc(numbatrakStarTiers.displayOrder));
  return rows.map(serializeTier);
}

export async function createTier(
  db: Database,
  organizationId: string,
  input: { name: string; minPoints: number; displayOrder?: number },
): Promise<NumbatrakStarTier> {
  const [row] = await db
    .insert(numbatrakStarTiers)
    .values({
      organizationId,
      name: input.name,
      minPoints: input.minPoints,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();
  return serializeTier(row!);
}

export async function deleteTier(db: Database, organizationId: string, tierId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakStarTiers)
    .where(and(eq(numbatrakStarTiers.id, tierId), eq(numbatrakStarTiers.organizationId, organizationId)));
  return (result.rowCount ?? 0) > 0;
}

export async function listStars(db: Database, organizationId: string, month?: string): Promise<NumbatrakStar[]> {
  const conditions = [eq(numbatrakStars.organizationId, organizationId)];
  if (month) conditions.push(eq(numbatrakStars.month, month));

  const rows = await db
    .select({
      star: numbatrakStars,
      staffName: user.name,
    })
    .from(numbatrakStars)
    .innerJoin(numbatrakStaff, eq(numbatrakStars.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(numbatrakStars.awardedAt));

  const result: NumbatrakStar[] = [];
  for (const row of rows) {
    let awardedByName: string | null = null;
    if (row.star.awardedBy) {
      const [awarder] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.star.awardedBy)).limit(1);
      awardedByName = awarder?.name ?? null;
    }
    result.push(serializeStar(row.star, row.staffName, awardedByName));
  }
  return result;
}

export async function awardStar(
  db: Database,
  organizationId: string,
  staffId: string,
  points: number,
  reason: string,
  awardedBy: string,
): Promise<NumbatrakStar> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [row] = await db
    .insert(numbatrakStars)
    .values({ organizationId, staffId, points, reason, awardedBy, month })
    .returning();
  return serializeStar(row!, null, null);
}

export async function getLeaderboard(
  db: Database,
  organizationId: string,
  month?: string,
): Promise<NumbatrakLeaderboardEntry[]> {
  const conditions = [eq(numbatrakStars.organizationId, organizationId)];
  if (month) conditions.push(eq(numbatrakStars.month, month));

  const rows = await db
    .select({
      staffId: numbatrakStars.staffId,
      staffName: user.name,
      totalPoints: sql<number>`COALESCE(SUM(${numbatrakStars.points}), 0)::int`,
    })
    .from(numbatrakStars)
    .innerJoin(numbatrakStaff, eq(numbatrakStars.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(...conditions))
    .groupBy(numbatrakStars.staffId, user.name)
    .orderBy(sql`SUM(${numbatrakStars.points}) DESC`);

  const tiers = await listTiers(db, organizationId);

  return rows.map((row, idx) => {
    let tierName: string | null = null;
    for (const tier of [...tiers].reverse()) {
      if (row.totalPoints >= tier.minPoints) {
        tierName = tier.name;
        break;
      }
    }
    return {
      staffId: row.staffId,
      staffName: row.staffName,
      totalPoints: row.totalPoints,
      tierName,
      rank: idx + 1,
    };
  });
}
