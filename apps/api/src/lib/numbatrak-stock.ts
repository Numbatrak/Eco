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

/**
 * Whole-org version of getAgentProductOnHand, grouped by (agent, product) in
 * one query - the Inventory stock grid needs every cell at once, not N+1
 * single-pair lookups. Same signed-sum-by-movement-type rules as the
 * single-pair version above, decomposed into a UNION ALL of the "as
 * to_agent" and "as from_agent" perspective of each row (a row can affect
 * two different agents' cells at once, e.g. a transfer), then grouped.
 */
export async function getOrgStockGrid(
  db: Database,
  organizationId: string,
): Promise<{ agentId: number; productId: string; quantityOnHand: number }[]> {
  // agent_id/product_id are raw driver values here (no Drizzle bigint-mode
  // coercion applies to db.execute results the way it does for .select()) -
  // to_agent_id/from_agent_id are `bigint(mode: "number")` columns, so the
  // driver returns them as strings; must Number()-convert or callers that
  // Map-key against Drizzle-selected (already-numeric) agent ids will never
  // match.
  const rows = await db.execute<{ agent_id: string; product_id: string; on_hand: string | null }>(sql`
    SELECT agent_id, product_id, SUM(delta) AS on_hand
    FROM (
      SELECT to_agent_id AS agent_id, product_id,
        CASE
          WHEN movement_type IN ('waybill_to_agent', 'transfer', 'adjust') THEN quantity
          ELSE 0
        END AS delta
      FROM ${numbatrakStockMovements}
      WHERE organization_id = ${organizationId} AND to_agent_id IS NOT NULL

      UNION ALL

      SELECT from_agent_id AS agent_id, product_id,
        CASE
          WHEN movement_type IN ('deliver_to_customer', 'return_to_lagos', 'transfer', 'damaged', 'missing') THEN -quantity
          WHEN movement_type = 'adjust' AND to_agent_id IS NULL THEN -quantity
          WHEN movement_type = 'adjust' THEN quantity
          ELSE 0
        END AS delta
      FROM ${numbatrakStockMovements}
      WHERE organization_id = ${organizationId} AND from_agent_id IS NOT NULL
    ) AS contributions
    GROUP BY agent_id, product_id
  `);
  return (rows as unknown as { agent_id: string; product_id: string; on_hand: string | null }[]).map((r) => ({
    agentId: Number(r.agent_id),
    productId: r.product_id,
    quantityOnHand: Number(r.on_hand ?? 0),
  }));
}
