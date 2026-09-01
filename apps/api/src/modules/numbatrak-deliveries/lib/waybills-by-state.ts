import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { numbatrakAgents, numbatrakDeliveries, type Database } from "@platform/db";
import type { NumbatrakWaybillByState, NumbatrakWaybillsByStateQuery } from "@platform/shared-types";

/**
 * Server-side port of services/waybillsByState.ts. Groups Waybilled
 * deliveries by the delivering agent's state (comma-separated `locations`
 * field, excluding "lagos" - the central warehouse), one bucket per waybill
 * using the first non-Lagos state (or the state matching `query.state`).
 */
export async function fetchWaybillsByState(
  db: Database,
  organizationId: string,
  query: NumbatrakWaybillsByStateQuery,
): Promise<NumbatrakWaybillByState[]> {
  const conditions = [
    eq(numbatrakDeliveries.organizationId, organizationId),
    eq(numbatrakDeliveries.status, "Waybilled"),
  ];
  if (query.dateFrom) conditions.push(gte(numbatrakDeliveries.date, query.dateFrom));
  if (query.dateTo) conditions.push(lte(numbatrakDeliveries.date, query.dateTo));

  const rows = await db
    .select({
      date: numbatrakDeliveries.date,
      quantity: numbatrakDeliveries.quantity,
      cost: numbatrakDeliveries.cost,
      agentId: numbatrakDeliveries.agentId,
    })
    .from(numbatrakDeliveries)
    .where(and(...conditions));

  if (rows.length === 0) return [];

  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const agentLocations = new Map<number, string | null>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, locations: numbatrakAgents.locations })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentLocations.set(a.id, a.locations);
  }

  const stateMap = new Map<
    string,
    { totalQuantity: number; totalCost: number; waybillCount: number; dates: string[] }
  >();
  const today = new Date();

  for (const row of rows) {
    if (row.agentId == null) continue;
    const locationsRaw = agentLocations.get(row.agentId);
    if (!locationsRaw) continue;

    const states = locationsRaw
      .split(",")
      .map((loc) => loc.trim())
      .filter((loc) => loc && loc.toLowerCase() !== "lagos");
    if (states.length === 0) continue;

    let targetState: string;
    if (query.state) {
      const matching = states.find((s) => s.toLowerCase() === query.state!.toLowerCase());
      if (!matching) continue;
      targetState = matching;
    } else {
      targetState = states[0]!;
    }

    const bucket = stateMap.get(targetState) ?? {
      totalQuantity: 0,
      totalCost: 0,
      waybillCount: 0,
      dates: [] as string[],
    };
    bucket.totalQuantity += Number(row.quantity) || 0;
    bucket.totalCost += Number(row.cost) || 0;
    bucket.waybillCount += 1;
    bucket.dates.push(row.date);
    stateMap.set(targetState, bucket);
  }

  const result: NumbatrakWaybillByState[] = [...stateMap.entries()].map(([state, data]) => {
    const sortedDates = [...data.dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const earliestDate = sortedDates[0] ?? null;
    const latestDate = sortedDates[sortedDates.length - 1] ?? null;

    let averageDaysSinceWaybill: number | null = null;
    if (sortedDates.length > 0) {
      const totalDays = sortedDates.reduce((sum, dateStr) => {
        const days = Math.floor((today.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      averageDaysSinceWaybill = Math.round(totalDays / sortedDates.length);
    }

    return {
      state,
      totalQuantity: data.totalQuantity,
      totalCost: data.totalCost,
      waybillCount: data.waybillCount,
      earliestDate,
      latestDate,
      averageDaysSinceWaybill,
    };
  });

  return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
}
