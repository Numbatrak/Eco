// Shared agent on-hand computation for the numbatrak_stock_movements ledger.
// Reproduces the `agent_stock_v` Postgres view's signed-sum-by-movement-type
// logic (that view was never ported as a Drizzle object in Phase 1). Used by
// both numbatrak-orders (deliver_to_customer check) and numbatrak-deliveries
// (waybill_to_agent / transfer / adjust / damaged / missing writers) - kept
// here rather than forked into either module.
import { sql } from "drizzle-orm";
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
