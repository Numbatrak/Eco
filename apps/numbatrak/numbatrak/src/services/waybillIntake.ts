"use client";

import { supabase } from "../supabaseClient";
import { Delivery } from "../types/delivery";
import { createDelivery } from "./deliveries";
import { bulkWaybillToAgent } from "./stockMovements";
import { createUnifiedExpenseIdempotent } from "./unifiedExpenses";

export type WaybillIntakeLine = {
  agent_id: number;
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  csr?: string | null;
  sub_brand?: string | null;
};

async function recordWaybillFeeExpense(input: {
  organization_id: string;
  amount: number;
  agent_id: number;
  product_id: string;
  delivery_id: number;
  waybill_batch_id?: string | null;
  occurred_at: string;
  created_by?: string | null;
}) {
  if (input.amount <= 0) return;

  const batchNote = input.waybill_batch_id
    ? ` (batch ${input.waybill_batch_id.slice(0, 8)})`
    : "";

  await createUnifiedExpenseIdempotent({
    organization_id: input.organization_id,
    scope: "org",
    category: "operational",
    subcategory: "logistics_delivery_fees",
    amount: input.amount,
    agent_id: input.agent_id,
    product_id: input.product_id,
    note: `Waybill fee — delivery #${input.delivery_id}${batchNote}`,
    occurred_at: input.occurred_at,
    created_by: input.created_by ?? null,
    source_type: "waybill_fee",
    source_id: String(input.delivery_id),
  });
}

function mapDeliveryRow(data: Record<string, unknown>): Delivery {
  return {
    id: Number(data.id),
    date: String(data.date),
    csr: (data.csr as string | null) ?? null,
    agent_id: data.agent_id != null ? Number(data.agent_id) : null,
    status: data.status as "Waybilled" | "Delivered",
    product_id: String(data.product_id),
    quantity: Number(data.quantity),
    cost: Number(data.cost),
    waybilling_fee: Number(data.waybilling_fee || 0),
    sub_brand: (data.sub_brand as string | null) ?? null,
    waybill_batch_id: (data.waybill_batch_id as string | null) ?? null,
    created_at: (data.created_at as string | null) ?? null,
  };
}

/**
 * Post a waybill: delivery row (Waybilled) + stock-in to agent + fee-only expense.
 * Product cost is inventory value, not booked as operational expense here.
 */
export async function intakeWaybill(input: {
  organization_id: string;
  date: string;
  agent_id: number;
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  csr?: string | null;
  sub_brand?: string | null;
  waybill_batch_id?: string | null;
  recorded_by_user_id?: string | null;
}): Promise<Delivery> {
  if (!input.agent_id) {
    throw new Error("Agent is required to post a waybill.");
  }
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }

  const fee = input.waybilling_fee ?? 0;
  const occurredAt = new Date(input.date + "T12:00:00").toISOString();

  const delivery = await createDelivery({
    organization_id: input.organization_id,
    date: input.date,
    csr: input.csr ?? null,
    agent_id: input.agent_id,
    status: "Waybilled",
    product_id: input.product_id,
    quantity: input.quantity,
    cost: input.cost,
    waybilling_fee: fee,
    sub_brand: input.sub_brand ?? null,
    waybill_batch_id: input.waybill_batch_id ?? null,
  });

  await bulkWaybillToAgent({
    organization_id: input.organization_id,
    waybill_batch_id: input.waybill_batch_id ?? crypto.randomUUID(),
    occurred_at: occurredAt,
    recorded_by_user_id: input.recorded_by_user_id ?? null,
    lines: [
      {
        to_agent_id: input.agent_id,
        product_id: input.product_id,
        quantity: input.quantity,
        cost: input.cost,
        fee,
        legacy_delivery_id: delivery.id,
      },
    ],
  });

  await recordWaybillFeeExpense({
    organization_id: input.organization_id,
    amount: fee,
    agent_id: input.agent_id,
    product_id: input.product_id,
    delivery_id: delivery.id,
    waybill_batch_id: input.waybill_batch_id ?? null,
    occurred_at: occurredAt,
    created_by: input.recorded_by_user_id ?? null,
  });

  return delivery;
}

/**
 * Bulk waybill: one delivery row per line, linked stock movements, fee expenses only.
 */
export async function intakeWaybillBatch(input: {
  organization_id: string;
  occurred_at: string;
  csr?: string | null;
  lines: WaybillIntakeLine[];
  recorded_by_user_id?: string | null;
}): Promise<{ batchId: string; deliveries: Delivery[] }> {
  if (!input.lines.length) {
    throw new Error("Add at least one waybill line.");
  }

  const batchId = crypto.randomUUID();
  const date = input.occurred_at.slice(0, 10);

  const deliveryRows = input.lines.map((line) => ({
    organization_id: input.organization_id,
    date,
    csr: line.csr ?? input.csr ?? null,
    agent_id: line.agent_id,
    status: "Waybilled" as const,
    product_id: line.product_id,
    quantity: line.quantity,
    cost: line.cost,
    waybilling_fee: line.waybilling_fee ?? 0,
    sub_brand: line.sub_brand ?? null,
    waybill_batch_id: batchId,
  }));

  const { data: inserted, error } = await supabase
    .from("deliveries")
    .insert(deliveryRows)
    .select("*");

  if (error) {
    throw error;
  }
  if (!inserted?.length) {
    throw new Error("No delivery rows returned from batch insert.");
  }

  const deliveries = inserted.map(mapDeliveryRow);

  await bulkWaybillToAgent({
    organization_id: input.organization_id,
    waybill_batch_id: batchId,
    occurred_at: input.occurred_at,
    recorded_by_user_id: input.recorded_by_user_id ?? null,
    lines: input.lines.map((line, i) => ({
      to_agent_id: line.agent_id,
      product_id: line.product_id,
      quantity: line.quantity,
      cost: line.cost,
      fee: line.waybilling_fee ?? 0,
      legacy_delivery_id: deliveries[i].id,
    })),
  });

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    const fee = line.waybilling_fee ?? 0;
    if (fee <= 0) continue;
    await recordWaybillFeeExpense({
      organization_id: input.organization_id,
      amount: fee,
      agent_id: line.agent_id,
      product_id: line.product_id,
      delivery_id: deliveries[i].id,
      waybill_batch_id: batchId,
      occurred_at: input.occurred_at,
      created_by: input.recorded_by_user_id ?? null,
    });
  }

  return { batchId, deliveries };
}

/**
 * Historical / balance-only delivery row (e.g. import as Delivered).
 * Does not touch stock ledger or expenses.
 */
export async function intakeDeliveryRecord(input: {
  organization_id: string;
  date: string;
  csr?: string | null;
  agent_id?: number | null;
  status: "Waybilled" | "Delivered";
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  sub_brand?: string | null;
}): Promise<Delivery> {
  if (input.status === "Waybilled") {
    if (!input.agent_id) {
      throw new Error("Agent is required for Waybilled entries.");
    }
    return intakeWaybill({
      organization_id: input.organization_id,
      date: input.date,
      agent_id: input.agent_id,
      product_id: input.product_id,
      quantity: input.quantity,
      cost: input.cost,
      waybilling_fee: input.waybilling_fee,
      csr: input.csr,
      sub_brand: input.sub_brand,
    });
  }

  return createDelivery({
    organization_id: input.organization_id,
    date: input.date,
    csr: input.csr ?? null,
    agent_id: input.agent_id ?? null,
    status: input.status,
    product_id: input.product_id,
    quantity: input.quantity,
    cost: input.cost,
    waybilling_fee: input.waybilling_fee ?? 0,
    sub_brand: input.sub_brand ?? null,
  });
}
