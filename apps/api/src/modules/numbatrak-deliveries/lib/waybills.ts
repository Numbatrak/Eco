import { numbatrakDeliveries, numbatrakStockMovements, numbatrakUnifiedExpenses, type Database } from "@platform/db";
import type { CreateNumbatrakWaybillBatchRequest, NumbatrakDelivery } from "@platform/shared-types";
import { randomUUID } from "node:crypto";
import { attachRelations } from "./deliveries.js";

/**
 * Waybill-out: HQ/Lagos → agent stock-in. Inserts one numbatrak_deliveries
 * row (status=Waybilled) per line, plus one numbatrak_stock_movements row
 * per line (movement_type='waybill_to_agent', to_agent_id only - stock is
 * created at the destination agent, HQ/Lagos is never decremented, matching
 * the source app exactly). Lines share one waybill_batch_id when called with
 * more than one line (batch UI), or get a fresh one for a single-line intake
 * too - the source app always generates one client-side.
 * If waybillingFee > 0 on a line, records an idempotent org-scope unified
 * expense (subcategory logistics_delivery_fees) keyed on the delivery row id
 * - the product cost itself is inventory value, never booked as an expense.
 */
export async function createWaybillBatch(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakWaybillBatchRequest,
): Promise<NumbatrakDelivery[]> {
  const batchId = randomUUID();
  const deliveryRows: (typeof numbatrakDeliveries.$inferSelect)[] = [];

  for (const line of input.lines) {
    const [delivery] = await db
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
      })
      .returning();
    if (!delivery) throw new Error("Failed to create delivery row for waybill line");
    deliveryRows.push(delivery);

    await db.insert(numbatrakStockMovements).values({
      organizationId,
      movementType: "waybill_to_agent",
      productId: line.productId,
      quantity: line.quantity,
      toAgentId: line.agentId,
      waybillBatchId: batchId,
      legacyDeliveryId: delivery.id,
      cost: String(line.cost),
      fee: String(line.waybillingFee ?? 0),
    });

    const fee = line.waybillingFee ?? 0;
    if (fee > 0) {
      await db
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

  return attachRelations(db, deliveryRows);
}
