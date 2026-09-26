import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import {
  numbatrakAgents,
  numbatrakProducts,
  numbatrakProductVariants,
  numbatrakStockMovements,
  numbatrakUnifiedExpenses,
  user,
  type Database,
} from "@platform/db";
import type {
  CreateNumbatrakShrinkageMovementRequest,
  CreateNumbatrakTransferMovementRequest,
  ListNumbatrakStockMovementsQuery,
  NumbatrakAgentStockOnHandRow,
  NumbatrakStockGridQuery,
  NumbatrakStockMovement,
} from "@platform/shared-types";
import { getAgentProductOnHand, getOrgStockGrid } from "../../../lib/numbatrak-stock.js";
import { parseLocations } from "../../numbatrak-agents/lib/agents.js";

export type StockMovementRow = typeof numbatrakStockMovements.$inferSelect;

async function attachNames(db: Database, rows: StockMovementRow[]): Promise<NumbatrakStockMovement[]> {
  if (rows.length === 0) return [];

  const agentIds = [
    ...new Set(
      rows.flatMap((r) => [r.fromAgentId, r.toAgentId]).filter((id): id is number => id != null),
    ),
  ];
  const agentNames = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentNames.set(a.id, a.name);
  }

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const productNames = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    for (const p of products) productNames.set(p.id, p.name);
  }

  const userIds = [
    ...new Set(rows.map((r) => r.recordedByUserId).filter((id): id is string => id != null)),
  ];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds));
    for (const u of users) userNames.set(u.id, u.name);
  }

  const variantIds = [...new Set(rows.map((r) => r.variantId).filter((id): id is string => id != null))];
  const variantNames = new Map<string, string>();
  if (variantIds.length > 0) {
    const variants = await db
      .select({ id: numbatrakProductVariants.id, name: numbatrakProductVariants.name })
      .from(numbatrakProductVariants)
      .where(inArray(numbatrakProductVariants.id, variantIds));
    for (const v of variants) variantNames.set(v.id, v.name);
  }

  return rows.map((row) => ({
    id: row.id,
    movementType: row.movementType as NumbatrakStockMovement["movementType"],
    productId: row.productId,
    productName: productNames.get(row.productId) ?? null,
    variantId: row.variantId,
    variantName: row.variantId != null ? (variantNames.get(row.variantId) ?? null) : null,
    quantity: row.quantity,
    fromAgentId: row.fromAgentId,
    fromAgentName: row.fromAgentId != null ? (agentNames.get(row.fromAgentId) ?? null) : null,
    toAgentId: row.toAgentId,
    toAgentName: row.toAgentId != null ? (agentNames.get(row.toAgentId) ?? null) : null,
    orderId: row.orderId,
    waybillBatchId: row.waybillBatchId,
    occurredAt: row.occurredAt.toISOString(),
    cost: row.cost ?? "0",
    fee: row.fee ?? "0",
    recordedByUserId: row.recordedByUserId,
    recordedByUserName: row.recordedByUserId != null ? (userNames.get(row.recordedByUserId) ?? null) : null,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));
}

export interface StockGridResult {
  cells: NumbatrakAgentStockOnHandRow[];
  costOfInventory: string;
}

/**
 * The Inventory feature's stock grid - one row per (agent, product) with a
 * nonzero-or-any on-hand quantity, named. Mirrors the source app's
 * `agent_stock_v` read (services/agentStock.ts::fetchAgentStockOnHand).
 * Also returns costOfInventory - every agent's holdings x cost price, summed
 * across the whole grid - as the spec's LOCKED cost-of-inventory rule needs a
 * server-side source of truth, not just the client's own recomputation.
 */
export async function getStockGrid(
  db: Database,
  organizationId: string,
  filters: NumbatrakStockGridQuery = {},
): Promise<StockGridResult> {
  const cells = await getOrgStockGrid(db, organizationId);
  if (cells.length === 0) return { cells: [], costOfInventory: "0" };

  const agentIds = [...new Set(cells.map((c) => c.agentId))];
  const productIds = [...new Set(cells.map((c) => c.productId))];
  const variantIds = [...new Set(cells.map((c) => c.variantId).filter((id): id is string => id != null))];

  const [agents, products, variants] = await Promise.all([
    db
      .select({
        id: numbatrakAgents.id,
        name: numbatrakAgents.name,
        isWarehouse: numbatrakAgents.isWarehouse,
        locations: numbatrakAgents.locations,
      })
      .from(numbatrakAgents)
      .where(and(eq(numbatrakAgents.organizationId, organizationId), inArray(numbatrakAgents.id, agentIds))),
    db
      .select({
        id: numbatrakProducts.id,
        name: numbatrakProducts.name,
        costPrice: numbatrakProducts.costPrice,
        subBrand: numbatrakProducts.subBrand,
      })
      .from(numbatrakProducts)
      .where(and(eq(numbatrakProducts.organizationId, organizationId), inArray(numbatrakProducts.id, productIds))),
    variantIds.length > 0
      ? db
          .select({ id: numbatrakProductVariants.id, name: numbatrakProductVariants.name })
          .from(numbatrakProductVariants)
          .where(inArray(numbatrakProductVariants.id, variantIds))
      : Promise.resolve([]),
  ]);

  const agentById = new Map(agents.map((a) => [a.id, a]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Cost-of-inventory is summed across every agent's holdings regardless of
  // the grid's own product/agent/subBrand/location filters - it's a whole-org
  // figure, not a filtered-view figure.
  let costOfInventory = 0;
  for (const cell of cells) {
    const product = productById.get(cell.productId);
    if (!product) continue;
    costOfInventory += cell.quantityOnHand * Number(product.costPrice);
  }

  const filtered = cells.filter((c) => {
    const agent = agentById.get(c.agentId);
    const product = productById.get(c.productId);
    if (!agent || !product) return false;
    if (filters.agentId != null && c.agentId !== filters.agentId) return false;
    if (filters.productId != null && c.productId !== filters.productId) return false;
    if (filters.subBrand && product.subBrand !== filters.subBrand) return false;
    if (filters.location && !parseLocations(agent.locations).includes(filters.location)) return false;
    return true;
  });

  return {
    cells: filtered.map((c) => ({
      agentId: c.agentId,
      agentName: agentById.get(c.agentId)!.name,
      isWarehouse: agentById.get(c.agentId)!.isWarehouse,
      productId: c.productId,
      productName: productById.get(c.productId)!.name,
      variantId: c.variantId,
      variantName: c.variantId != null ? (variantById.get(c.variantId)?.name ?? null) : null,
      quantityOnHand: c.quantityOnHand,
    })),
    costOfInventory: costOfInventory.toFixed(2),
  };
}

export async function listMovements(
  db: Database,
  organizationId: string,
  filters: ListNumbatrakStockMovementsQuery,
): Promise<NumbatrakStockMovement[]> {
  const conditions = [eq(numbatrakStockMovements.organizationId, organizationId)];
  if (filters.productId) conditions.push(eq(numbatrakStockMovements.productId, filters.productId));
  if (filters.agentId != null) {
    conditions.push(
      or(
        eq(numbatrakStockMovements.fromAgentId, filters.agentId),
        eq(numbatrakStockMovements.toAgentId, filters.agentId),
      )!,
    );
  }
  if (filters.movementType) conditions.push(eq(numbatrakStockMovements.movementType, filters.movementType));
  if (filters.dateFrom) conditions.push(gte(numbatrakStockMovements.occurredAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(numbatrakStockMovements.occurredAt, new Date(filters.dateTo)));

  if (filters.subBrand) {
    const products = await db
      .select({ id: numbatrakProducts.id })
      .from(numbatrakProducts)
      .where(and(eq(numbatrakProducts.organizationId, organizationId), eq(numbatrakProducts.subBrand, filters.subBrand)));
    const ids = products.map((p) => p.id);
    conditions.push(ids.length > 0 ? inArray(numbatrakStockMovements.productId, ids) : sql`false`);
  }
  if (filters.location) {
    const agents = await db
      .select({ id: numbatrakAgents.id, locations: numbatrakAgents.locations })
      .from(numbatrakAgents)
      .where(eq(numbatrakAgents.organizationId, organizationId));
    const ids = agents.filter((a) => parseLocations(a.locations).includes(filters.location!)).map((a) => a.id);
    conditions.push(
      ids.length > 0
        ? or(inArray(numbatrakStockMovements.fromAgentId, ids), inArray(numbatrakStockMovements.toAgentId, ids))!
        : sql`false`,
    );
  }

  const query = db
    .select()
    .from(numbatrakStockMovements)
    .where(and(...conditions))
    .orderBy(desc(numbatrakStockMovements.occurredAt));

  const rows = filters.limit ? await query.limit(filters.limit) : await query;
  return attachNames(db, rows);
}

export async function createTransfer(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakTransferMovementRequest,
  recordedByUserId: string | null,
): Promise<NumbatrakStockMovement> {
  if (input.fromAgentId === input.toAgentId) {
    throw new Error("Source and destination agents must differ.");
  }
  const onHand = await getAgentProductOnHand(db, organizationId, input.fromAgentId, input.productId, input.variantId ?? null);
  if (onHand < input.quantity) {
    throw new Error(`Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`);
  }

  const fee = input.fee ?? 0;
  const [row] = await db
    .insert(numbatrakStockMovements)
    .values({
      organizationId,
      movementType: "transfer",
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      notes: input.notes,
      fee: String(fee),
      recordedByUserId,
    })
    .returning();
  if (!row) throw new Error("Failed to create transfer movement");

  // Mirrors the waybill-batch flow: an idempotent org-scope expense for the
  // fee only - the transferred stock itself is inventory value, not an
  // operational cost.
  if (fee > 0) {
    await db
      .insert(numbatrakUnifiedExpenses)
      .values({
        organizationId,
        scope: "org",
        category: "operational",
        subcategory: "logistics_delivery_fees",
        amount: String(fee),
        note: `Stock transfer fee — movement #${row.id}`,
        sourceType: "stock_transfer_fee",
        sourceId: row.id,
      })
      .onConflictDoNothing();
  }

  const [full] = await attachNames(db, [row]);
  return full!;
}

export async function createShrinkage(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakShrinkageMovementRequest,
  recordedByUserId: string | null,
): Promise<NumbatrakStockMovement> {
  const onHand = await getAgentProductOnHand(db, organizationId, input.fromAgentId, input.productId, input.variantId ?? null);
  if (onHand < input.quantity) {
    throw new Error(`Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`);
  }

  const [row] = await db
    .insert(numbatrakStockMovements)
    .values({
      organizationId,
      movementType: input.movementType,
      productId: input.productId,
      variantId: input.variantId ?? null,
      quantity: input.quantity,
      fromAgentId: input.fromAgentId,
      notes: input.notes,
      recordedByUserId,
    })
    .returning();
  if (!row) throw new Error("Failed to create shrinkage movement");
  const [full] = await attachNames(db, [row]);
  return full!;
}
