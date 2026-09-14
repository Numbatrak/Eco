import { eq } from "drizzle-orm";
import { numbatrakDashboardAlertThresholds, type Database } from "@platform/db";
import type {
  NumbatrakDashboardAlertThresholds,
  UpdateNumbatrakDashboardAlertThresholdsRequest,
} from "@platform/shared-types";

type Row = typeof numbatrakDashboardAlertThresholds.$inferSelect;

const NUMERIC_FIELDS = [
  "deliveryRateGreen",
  "deliveryRateAmber",
  "deliveryRateAlert",
  "roasGreen",
  "roasAmber",
  "profitPerOrderGreen",
  "profitPerOrderAmber",
  "businessRoiGreen",
  "businessRoiAmber",
  "realCpaAovGreen",
  "realCpaAovAmber",
  "minUndeliveredForAlert",
  "minWouldBeSalesForAlert",
  "cpaWeekOnWeekIncreasePct",
] as const;

function serialize(row: Row): NumbatrakDashboardAlertThresholds {
  const numeric = Object.fromEntries(
    NUMERIC_FIELDS.map((field) => [field, Number(row[field])]),
  ) as Record<(typeof NUMERIC_FIELDS)[number], number>;
  return {
    id: row.id,
    ...numeric,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateAlertThresholds(
  db: Database,
  organizationId: string,
): Promise<NumbatrakDashboardAlertThresholds> {
  const [existing] = await db
    .select()
    .from(numbatrakDashboardAlertThresholds)
    .where(eq(numbatrakDashboardAlertThresholds.organizationId, organizationId))
    .limit(1);

  if (existing) return serialize(existing);

  const [row] = await db
    .insert(numbatrakDashboardAlertThresholds)
    .values({ organizationId })
    .returning();
  return serialize(row!);
}

export async function updateAlertThresholds(
  db: Database,
  organizationId: string,
  input: UpdateNumbatrakDashboardAlertThresholdsRequest,
): Promise<NumbatrakDashboardAlertThresholds> {
  const current = await getOrCreateAlertThresholds(db, organizationId);
  const values: Partial<typeof numbatrakDashboardAlertThresholds.$inferInsert> = { updatedAt: new Date() };
  for (const field of NUMERIC_FIELDS) {
    const next = input[field];
    if (next !== undefined) values[field] = String(next);
  }

  const [row] = await db
    .update(numbatrakDashboardAlertThresholds)
    .set(values)
    .where(eq(numbatrakDashboardAlertThresholds.id, current.id))
    .returning();
  return serialize(row!);
}
