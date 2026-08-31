import { and, eq } from "drizzle-orm";
import { tenantDeliveryZoneRates, type Database } from "@platform/db";
import type { DeliveryZoneRate, NigeriaState } from "@platform/shared-types";

export type DeliveryZoneRateRow = typeof tenantDeliveryZoneRates.$inferSelect;

export function serializeZoneRate(row: DeliveryZoneRateRow): DeliveryZoneRate {
  // The column is plain text - only ever written via the PUT route, which
  // validates against nigeriaStateSchema, so this narrows safely.
  return { state: row.state as NigeriaState, feeCents: row.feeCents };
}

export async function listZoneRates(db: Database, tenantId: string): Promise<DeliveryZoneRateRow[]> {
  return db
    .select()
    .from(tenantDeliveryZoneRates)
    .where(eq(tenantDeliveryZoneRates.tenantId, tenantId))
    .orderBy(tenantDeliveryZoneRates.state);
}

export async function findZoneRate(db: Database, tenantId: string, state: string): Promise<DeliveryZoneRateRow | null> {
  const [row] = await db
    .select()
    .from(tenantDeliveryZoneRates)
    .where(and(eq(tenantDeliveryZoneRates.tenantId, tenantId), eq(tenantDeliveryZoneRates.state, state)))
    .limit(1);
  return row ?? null;
}

/** Save-the-whole-table form submission - delete all existing rates, then insert the new set. */
export async function replaceZoneRates(
  db: Database,
  tenantId: string,
  rates: DeliveryZoneRate[],
): Promise<DeliveryZoneRateRow[]> {
  return db.transaction(async (tx) => {
    await tx.delete(tenantDeliveryZoneRates).where(eq(tenantDeliveryZoneRates.tenantId, tenantId));
    if (rates.length === 0) return [];
    return tx
      .insert(tenantDeliveryZoneRates)
      .values(rates.map((rate) => ({ tenantId, state: rate.state, feeCents: rate.feeCents })))
      .returning();
  });
}
