"use client";

import { supabase } from "../supabaseClient";
import {
  StockMovement,
  StockMovementType,
  ShrinkageMovementType,
  StockMovementListOptions,
} from "../types/stockMovement";
import { getAgentProductOnHand } from "./agentStock";

export async function listStockMovements(
  organizationId: string,
  options?: StockMovementListOptions
) {
  let q = supabase
    .from("stock_movements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false });

  if (options?.product_id) {
    q = q.eq("product_id", options.product_id);
  }
  if (options?.agent_id != null) {
    q = q.or(
      `from_agent_id.eq.${options.agent_id},to_agent_id.eq.${options.agent_id}`
    );
  }
  if (options?.movement_type) {
    q = q.eq("movement_type", options.movement_type);
  }
  if (options?.date_from) {
    q = q.gte("occurred_at", options.date_from);
  }
  if (options?.date_to) {
    const end = new Date(options.date_to);
    end.setDate(end.getDate() + 1);
    q = q.lt("occurred_at", end.toISOString());
  }
  if (options?.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  if (error) {
    throw error;
  }
  return (data || []) as StockMovement[];
}

async function assertSufficientOnHand(input: {
  organization_id: string;
  agent_id: number;
  product_id: string;
  quantity: number;
}) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }
  const onHand = await getAgentProductOnHand(
    input.organization_id,
    input.agent_id,
    input.product_id
  );
  if (onHand < input.quantity) {
    throw new Error(
      `Insufficient stock. On hand: ${onHand}, requested: ${input.quantity}`
    );
  }
}

export async function createTransferMovement(input: {
  organization_id: string;
  from_agent_id: number;
  to_agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
  recorded_by_user_id?: string | null;
  occurred_at?: string;
}) {
  if (input.from_agent_id === input.to_agent_id) {
    throw new Error("Source and destination agents must differ.");
  }
  if (!input.notes?.trim()) {
    throw new Error("Transfer reason is required.");
  }

  await assertSufficientOnHand({
    organization_id: input.organization_id,
    agent_id: input.from_agent_id,
    product_id: input.product_id,
    quantity: input.quantity,
  });

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      organization_id: input.organization_id,
      movement_type: "transfer" as StockMovementType,
      product_id: input.product_id,
      quantity: input.quantity,
      from_agent_id: input.from_agent_id,
      to_agent_id: input.to_agent_id,
      occurred_at: input.occurred_at || new Date().toISOString(),
      notes: input.notes.trim(),
      recorded_by_user_id: input.recorded_by_user_id || null,
      cost: 0,
      fee: 0,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function createShrinkageMovement(input: {
  organization_id: string;
  movement_type: ShrinkageMovementType;
  from_agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
  recorded_by_user_id?: string | null;
  occurred_at?: string;
}) {
  if (!input.notes?.trim()) {
    throw new Error("Reason is required for damaged / missing stock.");
  }

  await assertSufficientOnHand({
    organization_id: input.organization_id,
    agent_id: input.from_agent_id,
    product_id: input.product_id,
    quantity: input.quantity,
  });

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      organization_id: input.organization_id,
      movement_type: input.movement_type,
      product_id: input.product_id,
      quantity: input.quantity,
      from_agent_id: input.from_agent_id,
      to_agent_id: null,
      occurred_at: input.occurred_at || new Date().toISOString(),
      notes: input.notes.trim(),
      recorded_by_user_id: input.recorded_by_user_id || null,
      cost: 0,
      fee: 0,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function bulkWaybillToAgent(input: {
  organization_id: string;
  waybill_batch_id: string;
  from_agent_id?: number | null;
  lines: {
    to_agent_id: number;
    product_id: string;
    quantity: number;
    cost: number;
    fee: number;
    notes?: string;
    legacy_delivery_id?: number | null;
  }[];
  recorded_by_user_id?: string | null;
  occurred_at?: string;
}) {
  const at = input.occurred_at || new Date().toISOString();

  if (input.from_agent_id != null) {
    for (const line of input.lines) {
      await assertSufficientOnHand({
        organization_id: input.organization_id,
        agent_id: input.from_agent_id,
        product_id: line.product_id,
        quantity: line.quantity,
      });
    }
  }

  const rows = input.lines.map((l) => ({
    organization_id: input.organization_id,
    movement_type: "waybill_to_agent" as StockMovementType,
    product_id: l.product_id,
    quantity: l.quantity,
    from_agent_id: input.from_agent_id ?? null,
    to_agent_id: l.to_agent_id,
    waybill_batch_id: input.waybill_batch_id,
    legacy_delivery_id: l.legacy_delivery_id ?? null,
    occurred_at: at,
    cost: l.cost,
    fee: l.fee,
    notes: l.notes || null,
    recorded_by_user_id: input.recorded_by_user_id || null,
  }));

  const { data, error } = await supabase
    .from("stock_movements")
    .insert(rows)
    .select("id");
  if (error) {
    throw error;
  }
  return data;
}

export async function createDeliveryMovement(input: {
  organization_id: string;
  from_agent_id: number;
  product_id: string;
  quantity: number;
  order_id?: string | null;
  cost?: number;
  fee?: number;
  occurred_at?: string;
}) {
  await assertSufficientOnHand({
    organization_id: input.organization_id,
    agent_id: input.from_agent_id,
    product_id: input.product_id,
    quantity: input.quantity,
  });

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      organization_id: input.organization_id,
      movement_type: "deliver_to_customer",
      product_id: input.product_id,
      quantity: input.quantity,
      from_agent_id: input.from_agent_id,
      to_agent_id: null,
      order_id: input.order_id || null,
      occurred_at: input.occurred_at || new Date().toISOString(),
      cost: input.cost ?? 0,
      fee: input.fee ?? 0,
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data;
}
