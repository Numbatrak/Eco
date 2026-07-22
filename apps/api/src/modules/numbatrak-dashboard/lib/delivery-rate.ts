import { eq, inArray } from "drizzle-orm";
import { numbatrakAgents, numbatrakDeliveries, type Database } from "@platform/db";
import type { NumbatrakDeliveryRateByLocation } from "@platform/shared-types";

function withinRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

function bucket(totalDeliveries: number, deliveredCount: number, waybilledCount: number) {
  return {
    totalDeliveries,
    deliveredCount,
    waybilledCount,
    deliveryRate: totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0,
  };
}

/** Server-side port of services/dashboard.ts's fetchDeliveryRateByLocation -
 * buckets deliveries into Lagos vs Outside-Lagos by the delivering agent's
 * `locations` field (comma-separated, case-insensitive "lagos" match).
 * Deliveries with no agent or no location data are skipped, same as source. */
export async function fetchDeliveryRateByLocation(
  db: Database,
  organizationId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<NumbatrakDeliveryRateByLocation[]> {
  const rows = await db
    .select({ date: numbatrakDeliveries.date, status: numbatrakDeliveries.status, agentId: numbatrakDeliveries.agentId })
    .from(numbatrakDeliveries)
    .where(eq(numbatrakDeliveries.organizationId, organizationId));

  const data = rows.filter((r) => withinRange(r.date, dateFrom, dateTo));

  const agentIds = [...new Set(data.map((d) => d.agentId).filter((id): id is number => id != null))];
  const lagosIds = new Set<number>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, locations: numbatrakAgents.locations })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) {
      const locs = a.locations ? a.locations.split(",").map((l) => l.trim()) : [];
      if (locs.some((l) => l.toLowerCase() === "lagos")) lagosIds.add(a.id);
    }
  }

  let lagosTotal = 0, lagosDelivered = 0, lagosWaybilled = 0;
  let outsideTotal = 0, outsideDelivered = 0, outsideWaybilled = 0;

  for (const row of data) {
    if (row.agentId == null) continue;
    const isLagos = lagosIds.has(row.agentId);
    if (isLagos) {
      lagosTotal += 1;
      if (row.status === "Delivered") lagosDelivered += 1;
      else if (row.status === "Waybilled") lagosWaybilled += 1;
    } else {
      outsideTotal += 1;
      if (row.status === "Delivered") outsideDelivered += 1;
      else if (row.status === "Waybilled") outsideWaybilled += 1;
    }
  }

  return [
    { location: "Overall", ...bucket(lagosTotal + outsideTotal, lagosDelivered + outsideDelivered, lagosWaybilled + outsideWaybilled) },
    { location: "Lagos", ...bucket(lagosTotal, lagosDelivered, lagosWaybilled) },
    { location: "Outside Lagos", ...bucket(outsideTotal, outsideDelivered, outsideWaybilled) },
  ];
}
