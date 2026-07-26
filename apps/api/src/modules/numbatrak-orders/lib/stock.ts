// Server-side port of the delivery-movement insert used by the source app's
// src/services/stockMovements.ts (assertSufficientOnHand / createDeliveryMovement).
// The on-hand computation itself now lives in apps/api/src/lib/numbatrak-stock.ts,
// shared with numbatrak-deliveries (which also writes to this ledger).
import { and, eq } from "drizzle-orm";
import { numbatrakStockMovements, type Database } from "@platform/db";
import { getAgentProductOnHand } from "../../../lib/numbatrak-stock.js";

export { getAgentProductOnHand };

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
