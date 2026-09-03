import { and, eq, desc, asc, inArray, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import {
  numbatrakStarSettings,
  numbatrakStarTiers,
  numbatrakStars,
  numbatrakStaff,
  numbatrakStrikes,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakStarSettings,
  NumbatrakStarTier,
  NumbatrakStar,
  NumbatrakLeaderboardEntry,
  NumbatrakSotmCandidate,
  NumbatrakSotmCandidatesResponse,
} from "@platform/shared-types";
import { getPayrollRun, awardSotm as awardPayrollSotm } from "../../numbatrak-payroll/lib/payroll.js";

type SettingsRow = typeof numbatrakStarSettings.$inferSelect;
type TierRow = typeof numbatrakStarTiers.$inferSelect;
type StarRow = typeof numbatrakStars.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakStarSettings {
  return {
    id: row.id,
    enabled: row.enabled,
    leaderboardStyle: row.leaderboardStyle as NumbatrakStarSettings["leaderboardStyle"],
    sotmEnabled: row.sotmEnabled,
    sotmCriteria: row.sotmCriteria as NumbatrakStarSettings["sotmCriteria"],
    sotmMinStarTier: row.sotmMinStarTier,
    sotmStrikeDisqualifies: row.sotmStrikeDisqualifies,
    sotmWinnerCount: row.sotmWinnerCount,
    sotmPrizeAmount: Number(row.sotmPrizeAmount),
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
    criteria: row.criteria,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeStar(row: StarRow, staffName: string | null, tierName: string | null, awardedByName: string | null): NumbatrakStar {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName,
    tierId: row.tierId,
    tierName,
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
    leaderboardStyle?: string;
    sotmEnabled?: boolean;
    sotmCriteria?: string;
    sotmMinStarTier?: number;
    sotmStrikeDisqualifies?: boolean;
    sotmWinnerCount?: number;
    sotmPrizeAmount?: number;
  },
): Promise<NumbatrakStarSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakStarSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.enabled !== undefined) values.enabled = input.enabled;
  if (input.leaderboardStyle !== undefined) values.leaderboardStyle = input.leaderboardStyle;
  if (input.sotmEnabled !== undefined) values.sotmEnabled = input.sotmEnabled;
  if (input.sotmCriteria !== undefined) values.sotmCriteria = input.sotmCriteria;
  if (input.sotmMinStarTier !== undefined) values.sotmMinStarTier = input.sotmMinStarTier;
  if (input.sotmStrikeDisqualifies !== undefined) values.sotmStrikeDisqualifies = input.sotmStrikeDisqualifies;
  if (input.sotmWinnerCount !== undefined) values.sotmWinnerCount = input.sotmWinnerCount;
  if (input.sotmPrizeAmount !== undefined) values.sotmPrizeAmount = String(input.sotmPrizeAmount);

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
  input: { name: string; minPoints: number; displayOrder?: number; criteria?: string | null },
): Promise<NumbatrakStarTier> {
  const [row] = await db
    .insert(numbatrakStarTiers)
    .values({
      organizationId,
      name: input.name,
      minPoints: input.minPoints,
      displayOrder: input.displayOrder ?? 0,
      criteria: input.criteria ?? null,
    })
    .returning();
  return serializeTier(row!);
}

export async function updateTier(
  db: Database,
  organizationId: string,
  tierId: string,
  input: { name?: string; minPoints?: number; displayOrder?: number; criteria?: string | null },
): Promise<NumbatrakStarTier | null> {
  const values: Partial<typeof numbatrakStarTiers.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.minPoints !== undefined) values.minPoints = input.minPoints;
  if (input.displayOrder !== undefined) values.displayOrder = input.displayOrder;
  if (input.criteria !== undefined) values.criteria = input.criteria;

  const [row] = await db
    .update(numbatrakStarTiers)
    .set(values)
    .where(and(eq(numbatrakStarTiers.id, tierId), eq(numbatrakStarTiers.organizationId, organizationId)))
    .returning();
  return row ? serializeTier(row) : null;
}

export async function deleteTier(db: Database, organizationId: string, tierId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakStarTiers)
    .where(and(eq(numbatrakStarTiers.id, tierId), eq(numbatrakStarTiers.organizationId, organizationId)))
    .returning({ id: numbatrakStarTiers.id });
  return result.length > 0;
}

export async function listStars(db: Database, organizationId: string, month?: string): Promise<NumbatrakStar[]> {
  const conditions = [eq(numbatrakStars.organizationId, organizationId)];
  if (month) conditions.push(eq(numbatrakStars.month, month));

  const rows = await db
    .select({
      star: numbatrakStars,
      staffName: user.name,
      tierName: numbatrakStarTiers.name,
    })
    .from(numbatrakStars)
    .innerJoin(numbatrakStaff, eq(numbatrakStars.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .leftJoin(numbatrakStarTiers, eq(numbatrakStars.tierId, numbatrakStarTiers.id))
    .where(and(...conditions))
    .orderBy(desc(numbatrakStars.awardedAt));

  const result: NumbatrakStar[] = [];
  for (const row of rows) {
    let awardedByName: string | null = null;
    if (row.star.awardedBy) {
      const [awarder] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.star.awardedBy)).limit(1);
      awardedByName = awarder?.name ?? null;
    }
    result.push(serializeStar(row.star, row.staffName, row.tierName ?? null, awardedByName));
  }
  return result;
}

export async function awardStar(
  db: Database,
  organizationId: string,
  staffId: string,
  tierId: string,
  reason: string,
  awardedBy: string,
): Promise<NumbatrakStar> {
  const [tier] = await db
    .select()
    .from(numbatrakStarTiers)
    .where(and(eq(numbatrakStarTiers.id, tierId), eq(numbatrakStarTiers.organizationId, organizationId)))
    .limit(1);
  if (!tier) throw new Error("Star tier not found.");

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // "Stars are TIERS a person holds, not a running tally" (LOCKED RULE) -
  // each award sets/replaces the held tier; `points` is legacy and unused.
  const [row] = await db
    .insert(numbatrakStars)
    .values({ organizationId, staffId, tierId, points: 1, reason, awardedBy, month })
    .returning();
  return serializeStar(row!, null, tier.name, null);
}

/** A staff member's current held tier = their most recent award's tier, if any. */
async function getCurrentTiers(db: Database, organizationId: string, staffIds: string[]): Promise<Map<string, TierRow | null>> {
  if (staffIds.length === 0) return new Map();
  const rows = await db
    .select({ staffId: numbatrakStars.staffId, tier: numbatrakStarTiers, awardedAt: numbatrakStars.awardedAt })
    .from(numbatrakStars)
    .leftJoin(numbatrakStarTiers, eq(numbatrakStars.tierId, numbatrakStarTiers.id))
    .where(and(eq(numbatrakStars.organizationId, organizationId), inArray(numbatrakStars.staffId, staffIds)))
    .orderBy(desc(numbatrakStars.awardedAt));

  const result = new Map<string, TierRow | null>();
  for (const row of rows) {
    if (!result.has(row.staffId)) result.set(row.staffId, row.tier ?? null);
  }
  return result;
}

interface OrderMetrics {
  revenue: number;
  deliveredCount: number;
  totalOrders: number;
  deliveryRate: number;
  upsellCount: number;
}

/** Per-CSR order metrics for one calendar month, in one grouped pass (no N+1). */
async function getOrgOrderMetrics(db: Database, organizationId: string, month: string): Promise<Map<string, OrderMetrics>> {
  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endMonth = new Date(startDate);
  endMonth.setUTCMonth(endMonth.getUTCMonth() + 1);

  const orderRows = await db
    .select({
      csrId: numbatrakCustomerOrders.csrId,
      totalOrders: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`coalesce(sum(${numbatrakCustomerOrders.orderRevenue}::numeric), 0)::float`,
      deliveredCount: sql<number>`count(*) filter (where ${numbatrakCustomerOrders.status} = 'delivered')::int`,
    })
    .from(numbatrakCustomerOrders)
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDate}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonth}`,
        sql`${numbatrakCustomerOrders.csrId} IS NOT NULL`,
      ),
    )
    .groupBy(numbatrakCustomerOrders.csrId);

  const upsellRows = await db
    .select({
      csrId: numbatrakCustomerOrders.csrId,
      upsellCount: sql<number>`coalesce(sum(${numbatrakCustomerOrderItems.quantity}::int), 0)::int`,
    })
    .from(numbatrakCustomerOrderItems)
    .innerJoin(numbatrakCustomerOrders, eq(numbatrakCustomerOrderItems.orderId, numbatrakCustomerOrders.id))
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        sql`${numbatrakCustomerOrderItems.addedByUserId} IS NOT NULL`,
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDate}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonth}`,
      ),
    )
    .groupBy(numbatrakCustomerOrders.csrId);

  const upsellByUser = new Map(upsellRows.map((r) => [r.csrId as string, r.upsellCount]));
  const result = new Map<string, OrderMetrics>();
  for (const row of orderRows) {
    if (!row.csrId) continue;
    const totalOrders = row.totalOrders;
    const deliveredCount = row.deliveredCount;
    result.set(row.csrId, {
      revenue: row.totalRevenue,
      deliveredCount,
      totalOrders,
      deliveryRate: totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0,
      upsellCount: upsellByUser.get(row.csrId) ?? 0,
    });
  }
  return result;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getLeaderboard(db: Database, organizationId: string, month?: string): Promise<NumbatrakLeaderboardEntry[]> {
  const settings = await getOrCreateSettings(db, organizationId);
  const effectiveMonth = month ?? currentMonth();

  const staffRows = await db
    .select({ id: numbatrakStaff.id, userId: numbatrakStaff.userId, name: user.name })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.active, true)));

  let tierByStaff = new Map<string, TierRow | null>();
  let metricsByUser = new Map<string, OrderMetrics>();
  if (settings.leaderboardStyle === "by_tier") {
    tierByStaff = await getCurrentTiers(db, organizationId, staffRows.map((s) => s.id));
  } else {
    metricsByUser = await getOrgOrderMetrics(db, organizationId, effectiveMonth);
    tierByStaff = await getCurrentTiers(db, organizationId, staffRows.map((s) => s.id));
  }

  const entries = staffRows.map((s) => {
    const tier = tierByStaff.get(s.id) ?? null;
    const metrics = metricsByUser.get(s.userId);
    let value = 0;
    if (settings.leaderboardStyle === "by_tier") {
      value = tier?.displayOrder ?? -1;
    } else if (settings.leaderboardStyle === "by_revenue") {
      value = metrics?.revenue ?? 0;
    } else if (settings.leaderboardStyle === "by_delivery_rate") {
      value = metrics?.deliveryRate ?? 0;
    } else {
      value = metrics?.upsellCount ?? 0;
    }
    return { staffId: s.id, staffName: s.name, tierName: tier?.name ?? null, value };
  });

  entries.sort((a, b) => b.value - a.value);
  return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
}

function computeSotmValue(criteria: string, tier: TierRow | null, metrics: OrderMetrics | undefined): number | null {
  switch (criteria) {
    case "highest_delivery":
      return metrics?.deliveredCount ?? 0;
    case "highest_delivery_rate":
      return metrics?.deliveryRate ?? 0;
    case "highest_revenue":
      return metrics?.revenue ?? 0;
    case "highest_revenue_per_order":
      return metrics && metrics.totalOrders > 0 ? metrics.revenue / metrics.totalOrders : 0;
    case "highest_star_tier":
      return tier?.displayOrder ?? -1;
    case "most_upsells":
      return metrics?.upsellCount ?? 0;
    default:
      return null; // "manual" - no computed ranking, head picks freely.
  }
}

export async function getSotmCandidates(db: Database, organizationId: string, month?: string): Promise<NumbatrakSotmCandidatesResponse> {
  const settings = await getOrCreateSettings(db, organizationId);
  const effectiveMonth = month ?? currentMonth();

  const staffRows = await db
    .select({ id: numbatrakStaff.id, userId: numbatrakStaff.userId, name: user.name })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.active, true)));

  const tierByStaff = await getCurrentTiers(db, organizationId, staffRows.map((s) => s.id));
  const metricsByUser = await getOrgOrderMetrics(db, organizationId, effectiveMonth);
  const tiers = await listTiers(db, organizationId);

  const strikeRows = settings.sotmStrikeDisqualifies
    ? await db
        .select({ staffId: numbatrakStrikes.staffId })
        .from(numbatrakStrikes)
        .where(and(eq(numbatrakStrikes.organizationId, organizationId), eq(numbatrakStrikes.cleared, false)))
    : [];
  const staffWithActiveStrike = new Set(strikeRows.map((r) => r.staffId));

  const candidates: NumbatrakSotmCandidate[] = staffRows.map((s) => {
    const tier = tierByStaff.get(s.id) ?? null;
    const metrics = metricsByUser.get(s.userId);
    const value = computeSotmValue(settings.sotmCriteria, tier, metrics);
    const hasActiveStrike = staffWithActiveStrike.has(s.id);

    const meetsMinTier = settings.sotmMinStarTier <= 0 || (tier?.displayOrder ?? -1) >= settings.sotmMinStarTier;
    let ineligibleReason: string | null = null;
    if (!meetsMinTier) {
      const minTierName = tiers.find((t) => t.displayOrder === settings.sotmMinStarTier)?.name ?? `tier ${settings.sotmMinStarTier}`;
      ineligibleReason = `Below the minimum star tier required (${minTierName}).`;
    } else if (hasActiveStrike) {
      ineligibleReason = "Disqualified by an active strike.";
    }

    return {
      staffId: s.id,
      staffName: s.name,
      tierName: tier?.name ?? null,
      value,
      hasActiveStrike,
      eligible: ineligibleReason === null,
      ineligibleReason,
    };
  });

  candidates.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return (b.value ?? 0) - (a.value ?? 0);
  });

  return { month: effectiveMonth, criteria: settings.sotmCriteria, candidates };
}

/**
 * Confirms this month's SOTM winner(s): flows the Stars module's own
 * sotmPrizeAmount into the matching Payroll line's calculatedSotmBonus for
 * each winner (spec: "prize flows to the Payroll SOTM component"). Requires
 * payroll to already have been run for that month - there's no line to
 * award onto otherwise.
 */
export async function confirmSotm(
  db: Database,
  organizationId: string,
  month: string,
  staffIds: string[],
): Promise<{ awarded: string[]; skipped: { staffId: string; reason: string }[] }> {
  const settings = await getOrCreateSettings(db, organizationId);
  const run = await getPayrollRun(db, organizationId, month, { all: true });
  if (!run) {
    return { awarded: [], skipped: staffIds.map((staffId) => ({ staffId, reason: `No payroll run for ${month} yet - run payroll first.` })) };
  }

  const awarded: string[] = [];
  const skipped: { staffId: string; reason: string }[] = [];
  for (const staffId of staffIds) {
    const line = run.lines.find((l) => l.staffId === staffId);
    if (!line) {
      skipped.push({ staffId, reason: `No payroll line for this staff member in ${month}.` });
      continue;
    }
    await awardPayrollSotm(db, line.id, true, settings.sotmPrizeAmount);
    awarded.push(staffId);
  }
  return { awarded, skipped };
}
