import { numbatrakInventoryLots, type Database } from "@platform/db";
import type { ReceiveNumbatrakInventoryStockRequest } from "@platform/shared-types";

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
  return row;
}
