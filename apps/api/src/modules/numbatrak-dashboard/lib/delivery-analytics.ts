import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { numbatrakAgents, numbatrakDeliveries, numbatrakProducts, type Database } from "@platform/db";
import type {
  NumbatrakDeliveryAnalyticsHeadline,
  NumbatrakDeliveryAnalyticsQuery,
  NumbatrakDeliveryBreakdownRow,
} from "@platform/shared-types";

type DeliveryRow = {
  date: string;
  status: string;
  cost: number;
  agentId: number | null;
  productId: string | null;
  csr: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeDeliveryRate(deliveredCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Number(((deliveredCount / totalCount) * 100).toFixed(1));
}

/** Server-side port of services/deliveryAnalytics.ts's fetchFilteredDeliveryRows. */
async function fetchFilteredRows(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<DeliveryRow[]> {
  const conditions = [eq(numbatrakDeliveries.organizationId, organizationId)];
  if (filters.dateFrom) conditions.push(gte(numbatrakDeliveries.date, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(numbatrakDeliveries.date, filters.dateTo));
  if (filters.agentId != null) conditions.push(eq(numbatrakDeliveries.agentId, filters.agentId));
  if (filters.productId) conditions.push(eq(numbatrakDeliveries.productUuid, filters.productId));
  if (filters.status) conditions.push(eq(numbatrakDeliveries.status, filters.status));
  if (filters.subBrand) conditions.push(eq(numbatrakDeliveries.subBrand, filters.subBrand));

  const rows = await db
    .select({
      date: numbatrakDeliveries.date,
      status: numbatrakDeliveries.status,
      cost: numbatrakDeliveries.cost,
      agentId: numbatrakDeliveries.agentId,
      productId: numbatrakDeliveries.productUuid,
      csr: numbatrakDeliveries.csr,
    })
    .from(numbatrakDeliveries)
    .where(and(...conditions));

  let result: DeliveryRow[] = rows.map((r) => ({
    date: r.date,
    status: r.status,
    cost: num(r.cost),
    agentId: r.agentId,
    productId: r.productId,
    csr: r.csr,
  }));

  const location = filters.location ?? "all";
  if (location !== "all") {
    const agentIds = [...new Set(result.map((r) => r.agentId).filter((id): id is number => id != null))];
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
    result = result.filter((r) => {
      if (r.agentId == null) return false;
      const lagos = lagosIds.has(r.agentId);
      return location === "lagos" ? lagos : !lagos;
    });
  }

  return result;
}

export async function fetchDeliveryAnalyticsHeadline(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<NumbatrakDeliveryAnalyticsHeadline> {
  const rows = await fetchFilteredRows(db, organizationId, filters);

  let waybilledValue = 0;
  let deliveredValue = 0;
  let waybilledCount = 0;
  let deliveredCount = 0;
  for (const row of rows) {
    if (row.status === "Delivered") {
      deliveredValue += row.cost;
      deliveredCount += 1;
    } else {
      // Waybilled or PickedUp - still outstanding, not yet confirmed delivered.
      waybilledValue += row.cost;
      waybilledCount += 1;
    }
  }

  return {
    waybilledValue,
    deliveredValue,
    balance: waybilledValue - deliveredValue,
    deliveryRate: computeDeliveryRate(deliveredCount, waybilledCount + deliveredCount),
    waybilledCount,
    deliveredCount,
  };
}

function bucketRows(
  rows: DeliveryRow[],
  keyFn: (row: DeliveryRow) => string | null,
  labels: Map<string, string>,
  fallbackLabel: (key: string) => string = (key) => key,
): NumbatrakDeliveryBreakdownRow[] {
  const buckets = new Map<
    string,
    { waybilledValue: number; deliveredValue: number; waybilledCount: number; deliveredCount: number }
  >();

  for (const row of rows) {
    const key = keyFn(row);
    if (key == null) continue;
    const bucket = buckets.get(key) ?? {
      waybilledValue: 0,
      deliveredValue: 0,
      waybilledCount: 0,
      deliveredCount: 0,
    };
    if (row.status === "Delivered") {
      bucket.deliveredValue += row.cost;
      bucket.deliveredCount += 1;
    } else {
      // Waybilled or PickedUp - still outstanding, not yet confirmed delivered.
      bucket.waybilledValue += row.cost;
      bucket.waybilledCount += 1;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, b]) => {
      const totalCount = b.waybilledCount + b.deliveredCount;
      return {
        key,
        label: labels.get(key) ?? fallbackLabel(key),
        waybilledValue: b.waybilledValue,
        deliveredValue: b.deliveredValue,
        balance: b.waybilledValue - b.deliveredValue,
        deliveryRate: computeDeliveryRate(b.deliveredCount, totalCount),
        waybilledCount: b.waybilledCount,
        deliveredCount: b.deliveredCount,
      };
    })
    .sort((a, b) => b.waybilledValue + b.deliveredValue - (a.waybilledValue + a.deliveredValue));
}

export async function fetchDeliveryBreakdownByAgent(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<NumbatrakDeliveryBreakdownRow[]> {
  const rows = await fetchFilteredRows(db, organizationId, filters);
  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const labels = new Map<string, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) labels.set(String(a.id), a.name);
  }
  return bucketRows(
    rows,
    (r) => (r.agentId != null ? String(r.agentId) : null),
    labels,
    (key) => `Agent #${key}`,
  );
}

export async function fetchDeliveryBreakdownByProduct(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<NumbatrakDeliveryBreakdownRow[]> {
  const rows = await fetchFilteredRows(db, organizationId, filters);
  const productIds = [...new Set(rows.map((r) => r.productId).filter((id): id is string => id != null))];
  const labels = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    for (const p of products) labels.set(p.id, p.name);
  }
  return bucketRows(rows, (r) => r.productId ?? "unknown", labels);
}

/**
 * Groups by the delivery's CRS (sales rep), a request from the 2026-09-10
 * requirements review: "Performance tracking must shift to focus on specific
 * CRS rather than generic agents." Distinct from fetchDeliveryBreakdownByAgent
 * (agent = delivery partner) - `csr` is the free-text sales-rep name already
 * resolved at import time (see deliveries.ts schema comment).
 */
export async function fetchDeliveryBreakdownByCsr(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<NumbatrakDeliveryBreakdownRow[]> {
  const rows = await fetchFilteredRows(db, organizationId, filters);
  const labels = new Map<string, string>([["unassigned", "Unassigned"]]);
  return bucketRows(rows, (r) => r.csr?.trim() || "unassigned", labels);
}

export async function fetchDeliveryBreakdownByLocation(
  db: Database,
  organizationId: string,
  filters: NumbatrakDeliveryAnalyticsQuery,
): Promise<NumbatrakDeliveryBreakdownRow[]> {
  const rows = await fetchFilteredRows(db, organizationId, { ...filters, location: "all" });
  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const lagosIds = new Set<number>();
  const knownAgents = new Set<number>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, locations: numbatrakAgents.locations })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) {
      knownAgents.add(a.id);
      const locs = a.locations ? a.locations.split(",").map((l) => l.trim()) : [];
      if (locs.some((l) => l.toLowerCase() === "lagos")) lagosIds.add(a.id);
    }
  }
  const labels = new Map([
    ["lagos", "Lagos"],
    ["outside_lagos", "Outside Lagos"],
  ]);
  return bucketRows(rows, (r) => {
    if (r.agentId == null || !knownAgents.has(r.agentId)) return null;
    return lagosIds.has(r.agentId) ? "lagos" : "outside_lagos";
  }, labels);
}
