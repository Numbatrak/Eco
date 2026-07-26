import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { numbatrakInventoryLots, type Queryable } from "@platform/db";

export interface ConsumptionResult {
  /** Weighted-average unit cost across whatever lots were consumed (or the
   * flat cost_price when no lots exist for this product/variant at all). */
  totalCost: number;
}

/**
 * Verbatim TS port of create_order_from_normalized_submission's FIFO
 * consumption loop. Consumes `trueUnitCount` physical units (the accord
 * rule - includes free units, not just paid ones) from inventory_lots
 * ordered by received_at ASC, row-locked (SELECT ... FOR UPDATE) for the
 * duration of the enclosing transaction so concurrent submissions can't
 * double-spend the same lot.
 *
 * If NO lots exist at all for this (org, product, variant) combination,
 * lot tracking is considered "not in use" for this product and the caller
 * falls back to a flat cost (this function returns null to signal that -
 * matching the RPC's own "v_has_lots" branch, not an error).
 *
 * Must be called inside a `db.transaction()` - the row locks and the
 * decrement need to be part of the same atomic unit as the rest of the
 * order insert, since a later line's insufficient-inventory error must roll
 * back this line's already-applied decrements too.
 */
export async function consumeFifoLots(
  tx: Queryable,
  organizationId: string,
  productId: string,
  variantId: string | null,
  trueUnitCount: number,
): Promise<ConsumptionResult | null> {
  const variantCondition = variantId ? eq(numbatrakInventoryLots.variantId, variantId) : isNull(numbatrakInventoryLots.variantId);

  const totalRemaining = await tx
    .select({ total: sql<string>`coalesce(sum(${numbatrakInventoryLots.quantityRemaining}), 0)` })
    .from(numbatrakInventoryLots)
    .where(
      and(eq(numbatrakInventoryLots.organizationId, organizationId), eq(numbatrakInventoryLots.productId, productId), variantCondition),
    );
  const hasAnyLots = Number(totalRemaining[0]?.total ?? 0) > 0;
  if (!hasAnyLots) return null;

  const lots = await tx
    .select()
    .from(numbatrakInventoryLots)
    .where(
      and(
        eq(numbatrakInventoryLots.organizationId, organizationId),
        eq(numbatrakInventoryLots.productId, productId),
        variantCondition,
        gt(numbatrakInventoryLots.quantityRemaining, 0),
      ),
    )
    .orderBy(asc(numbatrakInventoryLots.receivedAt))
    .for("update");

  let remaining = trueUnitCount;
  let totalCost = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const consumed = Math.min(remaining, lot.quantityRemaining);
    totalCost += consumed * Number(lot.unitCost);
    remaining -= consumed;

    await tx
      .update(numbatrakInventoryLots)
      .set({ quantityRemaining: lot.quantityRemaining - consumed, updatedAt: new Date() })
      .where(eq(numbatrakInventoryLots.id, lot.id));
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient inventory for product ${productId} (need ${trueUnitCount}, short ${remaining})`,
    );
  }

  return { totalCost };
}
