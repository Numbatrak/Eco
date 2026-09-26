import { numbatrakDeliveries, numbatrakStockMovements, numbatrakUnifiedExpenses, type Database } from "@platform/db";
import type { CreateNumbatrakWaybillBatchRequest, NumbatrakDelivery } from "@platform/shared-types";
import { randomUUID } from "node:crypto";
import { attachRelations } from "./deliveries.js";
import { ensureWarehouseAgent } from "../../numbatrak-agents/lib/agents.js";
import { getAgentProductOnHand } from "../../../lib/numbatrak-stock.js";

/**
 * Waybill-out: HQ/Lagos → agent stock-in. Inserts one numbatrak_deliveries
 * row (status=Waybilled) per line, plus one numbatrak_stock_movements row
 * per line (movement_type='waybill_to_agent', fromAgentId=the org's HQ/
 * warehouse agent, toAgentId=the destination agent) - stock is now actually
 * decremented from HQ, not treated as infinite. Each line is checked against
 * HQ's current on-hand (variant-scoped) before it's allowed to dispatch; the
 * whole batch is one transaction, so a shortfall on any line rolls back
 * every line already processed in this call rather than leaving a partial
 * batch. Lines share one waybill_batch_id when called with more than one
 * line (batch UI), or get a fresh one for a single-line intake too - the
 * source app always generates one client-side.
 * If waybillingFee > 0 on a line, records an idempotent org-scope unified
 * expense (subcategory logistics_delivery_fees) keyed on the delivery row id
 * - the product cost itself is inventory value, never booked as an expense.
 */
export async function createWaybillBatch(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakWaybillBatchRequest,
  recordedByUserId: string | null,
): Promise<NumbatrakDelivery[]> {
  const warehouse = await ensureWarehouseAgent(db, organizationId);
  const batchId = randomUUID();

  const deliveryRows = await db.transaction(async (tx) => {
    const rows: (typeof numbatrakDeliveries.$inferSelect)[] = [];

    for (const line of input.lines) {
      const onHand = await getAgentProductOnHand(tx, organizationId, warehouse.id, line.productId, line.variantId ?? null);
      if (onHand < line.quantity) {
        throw new Error(`Insufficient HQ warehouse stock. On hand: ${onHand}, requested: ${line.quantity}`);
      }

      const [delivery] = await tx
        .insert(numbatrakDeliveries)
        .values({
          organizationId,
          date: input.date,
          csr: input.csr ?? null,
          agentId: line.agentId,
          status: "Waybilled",
          productUuid: line.productId,
          quantity: line.quantity,
          cost: String(line.cost),
          waybillingFee: String(line.waybillingFee ?? 0),
          subBrand: input.subBrand ?? null,
          waybillBatchId: batchId,
          recordedByUserId,
        })
        .returning();
      if (!delivery) throw new Error("Failed to create delivery row for waybill line");
      rows.push(delivery);

      await tx.insert(numbatrakStockMovements).values({
        organizationId,
        movementType: "waybill_to_agent",
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        fromAgentId: warehouse.id,
        toAgentId: line.agentId,
        waybillBatchId: batchId,
        legacyDeliveryId: delivery.id,
        cost: String(line.cost),
        fee: String(line.waybillingFee ?? 0),
        recordedByUserId,
      });

      const fee = line.waybillingFee ?? 0;
      if (fee > 0) {
        await tx
          .insert(numbatrakUnifiedExpenses)
          .values({
            organizationId,
            scope: "org",
            category: "operational",
            subcategory: "logistics_delivery_fees",
            amount: String(fee),
            note: `Waybill fee — delivery #${delivery.id}`,
            sourceType: "waybill_fee",
            sourceId: String(delivery.id),
          })
          .onConflictDoNothing();
      }
    }

    return rows;
  });

  return attachRelations(db, deliveryRows);
}
