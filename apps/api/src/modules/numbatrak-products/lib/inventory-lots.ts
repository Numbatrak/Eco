import { numbatrakInventoryLots, numbatrakStockMovements, type Database } from "@platform/db";
import type { ReceiveNumbatrakInventoryStockRequest } from "@platform/shared-types";
import { ensureWarehouseAgent } from "../../numbatrak-agents/lib/agents.js";

export async function receiveStock(
  db: Database,
  organizationId: string,
  productId: string,
  input: ReceiveNumbatrakInventoryStockRequest,
): Promise<typeof numbatrakInventoryLots.$inferSelect> {
  const [row] = await db
    .insert(numbatrakInventoryLots)
    .values({
      organizationId,
      productId,
      variantId: input.variantId ?? null,
      quantityRemaining: input.quantityRemaining,
      unitCost: String(input.unitCost),
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to receive stock");

  // Also credit the warehouse agent on the stock_movements ledger - the
  // Inventory grid page reads exclusively from that table, not inventory_lots
  // (see packages/db/src/schema/numbatrak/inventory.ts's "dual inventory
  // model" note), so without this the grid never reflects received stock.
  const warehouse = await ensureWarehouseAgent(db, organizationId);
  await db.insert(numbatrakStockMovements).values({
    organizationId,
    movementType: "adjust",
    productId,
    variantId: input.variantId ?? null,
    quantity: input.quantityRemaining,
    toAgentId: warehouse.id,
    cost: String(input.unitCost * input.quantityRemaining),
    notes: "Stock received",
  });

  return row;
}
