// Server-side port of the on-hand check + delivery-movement insert used by
// the source app's src/services/stockMovements.ts (assertSufficientOnHand /
// createDeliveryMovement) and the agent_stock_v view's per-movement-type
// sign logic (packages/db/src/schema/numbatrak/inventory.ts's Phase 1 notes:
// that view was never ported as a Drizzle object, so this is a plain
// aggregate query reproducing the same signed-sum logic for one agent+product
// pair, not a view).
import { and, eq, sql } from "drizzle-orm";
import { numbatrakStockMovements, type Database } from "@platform/db";

export async function getAgentProductOnHand(
  db: Database,
  organizationId: string,
  agentId: number,
  productId: string,
): Promise<number> {
  const rows = await db.execute<{ on_hand: string | null }>(sql`
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'waybill_to_agent' AND to_agent_id = ${agentId} THEN quantity
        WHEN movement_type = 'deliver_to_customer' AND from_agent_id = ${agentId} THEN -quantity
        WHEN movement_type = 'return_to_lagos' AND from_agent_id = ${agentId} THEN -quantity
        WHEN movement_type = 'transfer' AND to_agent_id = ${agentId} THEN quantity
        WHEN movement_type = 'transfer' AND from_agent_id = ${agentId} THEN -quantity
        WHEN movement_type = 'adjust' AND from_agent_id = ${agentId} AND to_agent_id IS NULL THEN -quantity
        WHEN movement_type = 'adjust' AND (from_agent_id = ${agentId} OR to_agent_id = ${agentId}) THEN quantity
        WHEN movement_type IN ('damaged', 'missing') AND from_agent_id = ${agentId} THEN -quantity
        ELSE 0
      END
    ), 0) AS on_hand
    FROM ${numbatrakStockMovements}
    WHERE organization_id = ${organizationId}
      AND product_id = ${productId}
      AND (from_agent_id = ${agentId} OR to_agent_id = ${agentId})
  `);
  const row = (rows as unknown as { on_hand: string | null }[])[0];
  return row ? Number(row.on_hand ?? 0) : 0;
}

export async function createDeliveryMovement(
  db: Database,
  input: {
    organizationId: string;
    fromAgentId: number;
    productId: string;
    quantity: number;
    orderId: string;
    cost: number;
  },
): Promise<void> {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }
  const onHand = await getAgentProductOnHand(db, input.organizationId, input.fromAgentId, input.productId);
  if (onHand < input.quantity) {
    throw new Error(`Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`);
  }

  await db.insert(numbatrakStockMovements).values({
    organizationId: input.organizationId,
    movementType: "deliver_to_customer",
    productId: input.productId,
    quantity: input.quantity,
    fromAgentId: input.fromAgentId,
    orderId: input.orderId,
    cost: String(input.cost),
    fee: "0",
  });
}

/** Which product ids already have a deliver_to_customer movement for this order (idempotency check). */
export async function productsAlreadyDelivered(
  db: Database,
  orderId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ productId: numbatrakStockMovements.productId })
    .from(numbatrakStockMovements)
    .where(
      and(
        eq(numbatrakStockMovements.orderId, orderId),
        eq(numbatrakStockMovements.movementType, "deliver_to_customer"),
      ),
    );
  return new Set(rows.map((r) => r.productId));
}
