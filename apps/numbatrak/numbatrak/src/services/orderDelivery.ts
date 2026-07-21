"use client";

import { createDeliveryMovement, listStockMovements } from "./stockMovements";
import { createUnifiedExpenseIdempotent } from "./unifiedExpenses";
import { isDeliveredStatus } from "../constants/orderStatus";

export type OrderLineForDelivery = {
  product_id: string;
  quantity: number;
  unit_cost_at_submission?: number;
};

export async function ensureDeliveryStockMovements(input: {
  organization_id: string;
  order_id: string;
  agent_id: number;
  items: OrderLineForDelivery[];
}): Promise<void> {
  const existing = await listStockMovements(input.organization_id, { limit: 1000 });
  const moved = new Set(
    existing
      .filter(
        (m) =>
          m.order_id === input.order_id &&
          m.movement_type === "deliver_to_customer"
      )
      .map((m) => m.product_id)
  );

  for (const item of input.items) {
    if (!item.product_id || item.quantity <= 0) continue;
    if (moved.has(item.product_id)) continue;

    await createDeliveryMovement({
      organization_id: input.organization_id,
      from_agent_id: input.agent_id,
      product_id: item.product_id,
      quantity: item.quantity,
      order_id: input.order_id,
      cost: item.unit_cost_at_submission ?? 0,
    });
    moved.add(item.product_id);
  }
}

export async function recordFailedDeliveryExpense(input: {
  organization_id: string;
  order_id: string;
  agent_id: number | null;
  amount: number;
  product_id?: string | null;
  note?: string | null;
  created_by?: string | null;
}): Promise<void> {
  if (input.amount <= 0) return;

  await createUnifiedExpenseIdempotent({
    organization_id: input.organization_id,
    scope: "agent",
    category: "operational",
    subcategory: "failed_delivery",
    amount: input.amount,
    agent_id: input.agent_id,
    order_id: input.order_id,
    product_id: input.product_id ?? null,
    note: input.note ?? "Failed delivery cost",
    occurred_at: new Date().toISOString(),
    created_by: input.created_by ?? null,
    source_type: "failed_delivery",
    source_id: input.order_id,
  });
}

export function assertCanMarkDelivered(input: {
  status: string | null | undefined;
  agent_id: number | null | undefined;
}): void {
  if (isDeliveredStatus(input.status)) {
    throw new Error("Order is already marked delivered.");
  }
  if (input.agent_id == null) {
    throw new Error("Assign a delivering agent before marking delivered.");
  }
}
