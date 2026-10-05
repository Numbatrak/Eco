import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { numbatrakAgents, numbatrakDeliveries, type Database } from "@platform/db";
import type { NumbatrakDeliveryRateByLocation, NumbatrakDeliveryStatus } from "@platform/shared-types";

function bucket(totalDeliveries: number, deliveredCount: number, waybilledCount: number) {
  return {
    totalDeliveries,
    deliveredCount,
    waybilledCount,
    deliveryRate: totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0,
  };
}

export interface DeliveryRateExtraFilters {
  agentId?: number;
  productId?: string;
  status?: NumbatrakDeliveryStatus;
  subBrand?: string;
}

const UNSPECIFIED_LOCATION = "Unspecified";

/** Buckets deliveries by the delivering agent's real declared location (the
 * `locations` field on numbatrak_agents - comma-separated since an agent can
 * cover more than one state). An agent covering multiple locations is
 * attributed to the first one listed; agents with no location on file group
 * under "Unspecified" rather than being silently folded into another bucket.
 * `extra` filters are only ever set by the Delivery Analytics page (the plain
 * Dashboard widget only passes dateFrom/dateTo). */
export async function fetchDeliveryRateByLocation(
  db: Database,
  organizationId: string,
  dateFrom?: string,
  dateTo?: string,
  extra?: DeliveryRateExtraFilters,
): Promise<NumbatrakDeliveryRateByLocation[]> {
  const conditions = [eq(numbatrakDeliveries.organizationId, organizationId)];
  if (dateFrom) conditions.push(gte(numbatrakDeliveries.date, dateFrom));
  if (dateTo) conditions.push(lte(numbatrakDeliveries.date, dateTo));
  if (extra?.agentId != null) conditions.push(eq(numbatrakDeliveries.agentId, extra.agentId));
  if (extra?.productId) conditions.push(eq(numbatrakDeliveries.productUuid, extra.productId));
  if (extra?.status) conditions.push(eq(numbatrakDeliveries.status, extra.status));
  if (extra?.subBrand) conditions.push(eq(numbatrakDeliveries.subBrand, extra.subBrand));

  const data = await db
    .select({ date: numbatrakDeliveries.date, status: numbatrakDeliveries.status, agentId: numbatrakDeliveries.agentId })
    .from(numbatrakDeliveries)
    .where(and(...conditions));

  const agentIds = [...new Set(data.map((d) => d.agentId).filter((id): id is number => id != null))];
  const primaryLocationByAgent = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, locations: numbatrakAgents.locations })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) {
      const locs = a.locations ? a.locations.split(",").map((l) => l.trim()).filter(Boolean) : [];
      primaryLocationByAgent.set(a.id, locs[0] ?? UNSPECIFIED_LOCATION);
    }
  }

  const totals = new Map<string, { total: number; delivered: number; waybilled: number }>();
  let overallTotal = 0, overallDelivered = 0, overallWaybilled = 0;

  for (const row of data) {
    if (row.agentId == null) continue;
    const location = primaryLocationByAgent.get(row.agentId) ?? UNSPECIFIED_LOCATION;
    const entry = totals.get(location) ?? { total: 0, delivered: 0, waybilled: 0 };
    entry.total += 1;
    overallTotal += 1;
    if (row.status === "Delivered") {
      entry.delivered += 1;
      overallDelivered += 1;
    } else {
      // Waybilled or PickedUp - still outstanding, not yet confirmed delivered.
      entry.waybilled += 1;
      overallWaybilled += 1;
    }
    totals.set(location, entry);
  }

  const byLocation = [...totals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([location, t]) => ({ location, ...bucket(t.total, t.delivered, t.waybilled) }));

  return [
    { location: "Overall", ...bucket(overallTotal, overallDelivered, overallWaybilled) },
    ...byLocation,
  ];
}
