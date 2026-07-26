import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { numbatrakAgents, numbatrakProducts, numbatrakStockMovements, type Database } from "@platform/db";
import type {
  CreateNumbatrakShrinkageMovementRequest,
  CreateNumbatrakTransferMovementRequest,
  ListNumbatrakStockMovementsQuery,
  NumbatrakAgentStockOnHandRow,
  NumbatrakStockMovement,
} from "@platform/shared-types";
import { getAgentProductOnHand, getOrgStockGrid } from "../../../lib/numbatrak-stock.js";

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

  return rows.map((row) => ({
    id: row.id,
    movementType: row.movementType as NumbatrakStockMovement["movementType"],
    productId: row.productId,
    productName: productNames.get(row.productId) ?? null,
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
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
  }));
}

/**
 * The Inventory feature's stock grid - one row per (agent, product) with a
 * nonzero-or-any on-hand quantity, named. Mirrors the source app's
 * `agent_stock_v` read (services/agentStock.ts::fetchAgentStockOnHand).
 */
export async function getStockGrid(db: Database, organizationId: string): Promise<NumbatrakAgentStockOnHandRow[]> {
  const cells = await getOrgStockGrid(db, organizationId);
  if (cells.length === 0) return [];

  const agentIds = [...new Set(cells.map((c) => c.agentId))];
  const productIds = [...new Set(cells.map((c) => c.productId))];

  const [agents, products] = await Promise.all([
    db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name, isWarehouse: numbatrakAgents.isWarehouse })
      .from(numbatrakAgents)
      .where(and(eq(numbatrakAgents.organizationId, organizationId), inArray(numbatrakAgents.id, agentIds))),
    db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(and(eq(numbatrakProducts.organizationId, organizationId), inArray(numbatrakProducts.id, productIds))),
  ]);

  const agentById = new Map(agents.map((a) => [a.id, a]));
  const productById = new Map(products.map((p) => [p.id, p]));

  return cells
    .filter((c) => agentById.has(c.agentId) && productById.has(c.productId))
    .map((c) => ({
      agentId: c.agentId,
      agentName: agentById.get(c.agentId)!.name,
      isWarehouse: agentById.get(c.agentId)!.isWarehouse,
      productId: c.productId,
      productName: productById.get(c.productId)!.name,
      quantityOnHand: c.quantityOnHand,
    }));
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
): Promise<NumbatrakStockMovement> {
  if (input.fromAgentId === input.toAgentId) {
    throw new Error("Source and destination agents must differ.");
  }
  const onHand = await getAgentProductOnHand(db, organizationId, input.fromAgentId, input.productId);
  if (onHand < input.quantity) {
    throw new Error(`Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`);
  }

  const [row] = await db
    .insert(numbatrakStockMovements)
    .values({
      organizationId,
      movementType: "transfer",
      productId: input.productId,
      quantity: input.quantity,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      notes: input.notes,
    })
    .returning();
  if (!row) throw new Error("Failed to create transfer movement");
  const [full] = await attachNames(db, [row]);
  return full!;
}

export async function createShrinkage(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakShrinkageMovementRequest,
): Promise<NumbatrakStockMovement> {
  const onHand = await getAgentProductOnHand(db, organizationId, input.fromAgentId, input.productId);
  if (onHand < input.quantity) {
    throw new Error(`Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`);
  }

  const [row] = await db
    .insert(numbatrakStockMovements)
    .values({
      organizationId,
      movementType: input.movementType,
      productId: input.productId,
      quantity: input.quantity,
      fromAgentId: input.fromAgentId,
      notes: input.notes,
    })
    .returning();
  if (!row) throw new Error("Failed to create shrinkage movement");
  const [full] = await attachNames(db, [row]);
  return full!;
}
