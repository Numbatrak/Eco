import { and, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { numbatrakAgents, numbatrakDeliveries, numbatrakProducts, type Database } from "@platform/db";
import type {
  CreateNumbatrakDeliveryRequest,
  ListNumbatrakDeliveriesQuery,
  MonthlyDeliverySummaryQuery,
  NumbatrakDelivery,
  NumbatrakMonthlyDeliverySummary,
  UpdateNumbatrakDeliveryRequest,
} from "@platform/shared-types";

export type DeliveryRow = typeof numbatrakDeliveries.$inferSelect;

export async function attachRelations(db: Database, rows: DeliveryRow[]): Promise<NumbatrakDelivery[]> {
  if (rows.length === 0) return [];

  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const agentNames = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentNames.set(a.id, a.name);
  }

  const productIds = [...new Set(rows.map((r) => r.productUuid).filter((id): id is string => id != null))];
  const productNames = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    for (const p of products) productNames.set(p.id, p.name);
  }

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    csr: row.csr,
    agentId: row.agentId,
    agentName: row.agentId != null ? (agentNames.get(row.agentId) ?? null) : null,
    status: row.status as NumbatrakDelivery["status"],
    productId: row.productUuid,
    productName: row.productUuid != null ? (productNames.get(row.productUuid) ?? null) : null,
    quantity: row.quantity,
    cost: row.cost,
    waybillingFee: row.waybillingFee,
    subBrand: row.subBrand,
    waybillBatchId: row.waybillBatchId,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));
}

export async function listDeliveriesForOrg(
  db: Database,
  organizationId: string,
  filters: ListNumbatrakDeliveriesQuery,
): Promise<NumbatrakDelivery[]> {
  const conditions = [eq(numbatrakDeliveries.organizationId, organizationId)];
  if (filters.agentId != null) conditions.push(eq(numbatrakDeliveries.agentId, filters.agentId));
  if (filters.productId) conditions.push(eq(numbatrakDeliveries.productUuid, filters.productId));
  if (filters.status) conditions.push(eq(numbatrakDeliveries.status, filters.status));
  if (filters.subBrand) conditions.push(eq(numbatrakDeliveries.subBrand, filters.subBrand));

  const rows = await db
    .select()
    .from(numbatrakDeliveries)
    .where(and(...conditions))
    .orderBy(desc(numbatrakDeliveries.date), desc(numbatrakDeliveries.createdAt));

  return attachRelations(db, rows);
}

/**
 * Plain metadata insert - no stock movement, no expense. Matches the source
 * app's "historical/balance-only delivery row" path (a manually-entered
 * Delivered row created outside the waybill-intake flow). Real waybill-out
 * (status=Waybilled with stock/expense side effects) is lib/waybills.ts.
 */
export async function createDelivery(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakDeliveryRequest,
): Promise<NumbatrakDelivery> {
  const [row] = await db
    .insert(numbatrakDeliveries)
    .values({
      organizationId,
      date: input.date,
      csr: input.csr ?? null,
      agentId: input.agentId ?? null,
      status: input.status,
      productUuid: input.productId,
      quantity: input.quantity,
      cost: String(input.cost),
      waybillingFee: String(input.waybillingFee ?? 0),
      subBrand: input.subBrand ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create delivery");
  const [full] = await attachRelations(db, [row]);
  return full!;
}

/**
 * Metadata-only update - editing a delivery never adjusts the stock ledger
 * even if agent/product/quantity/status change, matching the source app's
 * behavior exactly (edits are corrections to the logistics record, not new
 * stock events).
 */
export async function updateDelivery(
  db: Database,
  organizationId: string,
  deliveryId: number,
  input: UpdateNumbatrakDeliveryRequest,
): Promise<NumbatrakDelivery | null> {
  const values: Partial<typeof numbatrakDeliveries.$inferInsert> = {};
  if (input.date !== undefined) values.date = input.date;
  if (input.csr !== undefined) values.csr = input.csr;
  if (input.agentId !== undefined) values.agentId = input.agentId;
  if (input.status !== undefined) values.status = input.status;
  if (input.productId !== undefined) values.productUuid = input.productId;
  if (input.quantity !== undefined) values.quantity = input.quantity;
  if (input.cost !== undefined) values.cost = String(input.cost);
  if (input.waybillingFee !== undefined) values.waybillingFee = String(input.waybillingFee);
  if (input.subBrand !== undefined) values.subBrand = input.subBrand;

  const [row] = await db
    .update(numbatrakDeliveries)
    .set(values)
    .where(and(eq(numbatrakDeliveries.organizationId, organizationId), eq(numbatrakDeliveries.id, deliveryId)))
    .returning();
  if (!row) return null;
  const [full] = await attachRelations(db, [row]);
  return full!;
}

export async function removeDelivery(db: Database, organizationId: string, deliveryId: number): Promise<boolean> {
  const result = await db
    .delete(numbatrakDeliveries)
    .where(and(eq(numbatrakDeliveries.organizationId, organizationId), eq(numbatrakDeliveries.id, deliveryId)))
    .returning({ id: numbatrakDeliveries.id });
  return result.length > 0;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const QUARTER_MONTHS: Record<string, number[]> = { Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] };

export async function fetchMonthlySummary(
  db: Database,
  organizationId: string,
  query: MonthlyDeliverySummaryQuery,
): Promise<NumbatrakMonthlyDeliverySummary[]> {
  const conditions = [
    eq(numbatrakDeliveries.organizationId, organizationId),
    gte(numbatrakDeliveries.date, `${query.year}-01-01`),
    lte(numbatrakDeliveries.date, `${query.year}-12-31`),
  ];
  if (query.agentId != null) conditions.push(eq(numbatrakDeliveries.agentId, query.agentId));
  if (query.productId) conditions.push(eq(numbatrakDeliveries.productUuid, query.productId));
  if (query.csrText) conditions.push(ilike(numbatrakDeliveries.csr, `%${query.csrText.trim()}%`));
  if (query.status) conditions.push(eq(numbatrakDeliveries.status, query.status));
  if (query.subBrand) conditions.push(eq(numbatrakDeliveries.subBrand, query.subBrand));

  let rows = await db
    .select({
      date: numbatrakDeliveries.date,
      status: numbatrakDeliveries.status,
      cost: numbatrakDeliveries.cost,
      waybillingFee: numbatrakDeliveries.waybillingFee,
      agentId: numbatrakDeliveries.agentId,
    })
    .from(numbatrakDeliveries)
    .where(and(...conditions));

  if (query.location && query.location !== "all" && rows.length > 0) {
    const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
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
    rows = rows.filter((r) => {
      if (r.agentId == null) return false;
      const lagos = lagosIds.has(r.agentId);
      return query.location === "lagos" ? lagos : !lagos;
    });
  }

  const months: NumbatrakMonthlyDeliverySummary[] = MONTHS.map((month, i) => ({
    month,
    monthNumber: i + 1,
    waybilled: 0,
    delivered: 0,
    balance: 0,
    waybillFee: 0,
  }));

  for (const row of rows) {
    const monthIndex = new Date(row.date).getMonth();
    const cost = Number(row.cost);
    const fee = Number(row.waybillingFee ?? 0);
    if (row.status === "Waybilled") {
      months[monthIndex]!.waybilled += cost;
      months[monthIndex]!.waybillFee += fee;
    } else if (row.status === "Delivered") {
      months[monthIndex]!.delivered += cost;
    }
  }
  for (const m of months) m.balance = m.waybilled - m.delivered;

  if (query.quarter && query.quarter !== "all") {
    const idx = QUARTER_MONTHS[query.quarter];
    if (idx) return months.filter((m) => idx.includes(m.monthNumber - 1));
  }

  return months;
}
