"use client";

import { supabase } from "../supabaseClient";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import { moneyReceivedByToPaymentMethod } from "../constants/orderAttribution";
import { statusFilterToDbValues } from "../constants/orderStatus";
import {
  CustomerOrderWithRelations,
  CustomerOrderItem,
  CustomerOrderFilters,
  CustomerOrderStatus,
} from "../types/customerOrder";
import { emptyWithoutOrg } from "./orgQuery";
import { getNextAssignedUser } from "./orderAssignmentSettings";

/**
 * List customer orders (greenfield `customer_orders`) with items and light relations.
 */
export async function fetchCustomerOrders(
  organizationId: string | null,
  filters: CustomerOrderFilters = {}
): Promise<CustomerOrderWithRelations[]> {
  const empty = emptyWithoutOrg<CustomerOrderWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase
    .from("customer_orders")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (filters.status) {
    const statuses = statusFilterToDbValues(filters.status);
    query =
      statuses.length === 1
        ? query.eq("status", statuses[0])
        : query.in("status", statuses);
  }
  if (filters.form_id) {
    query = query.eq("form_id", filters.form_id);
  }
  if (filters.csr_id) {
    query = query.eq("csr_id", filters.csr_id);
  }
  if (filters.agent_id != null) {
    query = query.eq("agent_id", filters.agent_id);
  }
  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  if (filters.date_to) {
    const end = new Date(filters.date_to);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  if (filters.sub_brand) {
    query = query.eq("sub_brand", filters.sub_brand);
  }
  if (filters.funnel_name) {
    query = query.eq("funnel_name", filters.funnel_name);
  }
  if (filters.offer_name) {
    query = query.eq("offer_name", filters.offer_name);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw error;
  }
  if (!rows?.length) {
    return [];
  }

  const orderIds = rows.map((r: any) => r.id);
  const { data: itemRows } = await supabase
    .from("customer_order_items")
    .select("*")
    .in("order_id", orderIds);

  const itemsByOrder = new Map<string, CustomerOrderItem[]>();
  (itemRows || []).forEach((it: any) => {
    const list = itemsByOrder.get(it.order_id) || [];
    list.push({
      id: it.id,
      order_id: it.order_id,
      product_id: it.product_id,
      quantity: Number(it.quantity) || 0,
      unit_price_at_submission: Number(it.unit_price_at_submission) || 0,
      unit_cost_at_submission: Number(it.unit_cost_at_submission) || 0,
      total_price: Number(it.total_price) || 0,
      total_cost: Number(it.total_cost) || 0,
      profit: Number(it.profit) || 0,
      created_at: it.created_at,
    });
    itemsByOrder.set(it.order_id, list);
  });

  const productIds = [
    ...new Set(
      (itemRows || []).map((it: any) => it.product_id).filter(Boolean)
    ),
  ] as string[];
  let productNames: Record<string, string> = {};
  if (productIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    (products || []).forEach((p: any) => {
      productNames[p.id] = p.name;
    });
  }

  const csrIds = [
    ...new Set(rows.map((r: any) => r.csr_id).filter(Boolean)),
  ] as string[];
  const csrMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
  if (csrIds.length) {
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", csrIds);
    (profs || []).forEach((p: any) => {
      csrMap.set(p.id, p);
    });
  }

  const formIds = [
    ...new Set(rows.map((r: any) => r.form_id).filter(Boolean)),
  ] as string[];
  const formMap = new Map<string, { id: string; name: string }>();
  if (formIds.length) {
    const { data: forms } = await supabase
      .from("forms")
      .select("id, name")
      .in("id", formIds);
    (forms || []).forEach((f: any) => {
      formMap.set(f.id, f);
    });
  }

  const agentIds = [
    ...new Set(
      rows.map((r: any) => r.agent_id).filter((x: any) => x != null)
    ),
  ] as number[];
  const agentMap = new Map<number, { id: number; name: string }>();
  if (agentIds.length) {
    const { data: ags } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);
    (ags || []).forEach((a: any) => {
      agentMap.set(Number(a.id), { id: Number(a.id), name: a.name });
    });
  }

  const search = filters.search?.trim().toLowerCase();
  const out: CustomerOrderWithRelations[] = [];

  for (const row of rows as any[]) {
    const base = {
      id: row.id,
      organization_id: row.organization_id,
      form_response_id: row.form_response_id,
      form_id: row.form_id,
      csr_id: row.csr_id,
      agent_id: row.agent_id != null ? Number(row.agent_id) : null,
      status: row.status as CustomerOrderStatus,
      source: row.source,
      customer_name: row.customer_name,
      phone_number: row.phone_number,
      state: row.state,
      delivery_address: row.delivery_address,
      order_revenue: row.order_revenue != null ? Number(row.order_revenue) : null,
      order_cost: row.order_cost != null ? Number(row.order_cost) : null,
      amount_paid: row.amount_paid != null ? Number(row.amount_paid) : null,
      delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
      profit: row.profit != null ? Number(row.profit) : null,
      notes: row.notes,
      abandoned_cart_id: row.abandoned_cart_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
      offer_name: row.offer_name ?? null,
      funnel_name: row.funnel_name ?? null,
      sub_brand: row.sub_brand ?? null,
      money_received_by: row.money_received_by ?? "agent_collected",
      payment_method: row.payment_method ?? null,
      wallet_status: row.wallet_status ?? null,
      items: itemsByOrder.get(row.id) || [],
      csr: row.csr_id ? csrMap.get(row.csr_id) || null : null,
      form: row.form_id ? formMap.get(row.form_id) || null : null,
      agent: row.agent_id != null ? agentMap.get(Number(row.agent_id)) || null : null,
      productNames,
    };

    if (search) {
      const pack =
        (base.items || [])
          .map((i) => productNames[i.product_id] || "")
          .join(" ") + " ";
      const hay = `${base.customer_name || ""} ${base.phone_number || ""} ${base.notes || ""} ${pack}`.toLowerCase();
      if (!hay.includes(search)) continue;
    }
    out.push(base);
  }

  return out;
}

export async function updateCustomerOrder(
  orderId: string,
  updates: Partial<{
    status: CustomerOrderStatus;
    notes: string | null;
    delivery_fee: number | null;
    amount_paid: number | null;
    agent_id: number | null;
    csr_id: string | null;
    completed_at: string | null;
    money_received_by: MoneyReceivedBy;
  }>
) {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.money_received_by != null) {
    payload.payment_method = moneyReceivedByToPaymentMethod(updates.money_received_by);
  }

  const { data, error } = await supabase
    .from("customer_orders")
    .update(payload)
    .eq("id", orderId)
    .select("form_response_id")
    .single();

  if (error) {
    throw error;
  }

  const frId = data?.form_response_id as string | null | undefined;
  if (frId) {
    const frUp: Record<string, unknown> = {};
    if (updates.status != null) {
      frUp["status"] = updates.status;
    }
    if (updates.notes !== undefined) {
      frUp["notes"] = updates.notes;
    }
    if (updates.delivery_fee !== undefined) {
      frUp["delivery_fee"] = updates.delivery_fee;
    }
    if (updates.amount_paid !== undefined) {
      frUp["amount_paid"] = updates.amount_paid;
    }
    if (updates.agent_id !== undefined) {
      frUp["agent_id"] = updates.agent_id;
    }
    if (updates.money_received_by !== undefined) {
      frUp["money_received_by"] = updates.money_received_by;
      frUp["payment_method"] = moneyReceivedByToPaymentMethod(
        updates.money_received_by
      );
    }
    if (Object.keys(frUp).length) {
      frUp["updated_at"] = new Date().toISOString();
      await supabase.from("form_responses").update(frUp).eq("id", frId);
    }
  }
}

export async function deleteCustomerOrder(orderId: string) {
  const { error } = await supabase.from("customer_orders").delete().eq("id", orderId);
  if (error) {
    throw error;
  }
}

/** Delete canonical order and linked form response (if any). */
export async function deleteCustomerOrderDeep(orderId: string) {
  const { data: row, error: fErr } = await supabase
    .from("customer_orders")
    .select("form_response_id")
    .eq("id", orderId)
    .single();
  if (fErr) {
    throw fErr;
  }
  const { error: d1 } = await supabase
    .from("customer_orders")
    .delete()
    .eq("id", orderId);
  if (d1) {
    throw d1;
  }
  if (row?.form_response_id) {
    const { error: d2 } = await supabase
      .from("form_responses")
      .delete()
      .eq("id", row.form_response_id);
    if (d2) {
      console.error("delete form_responses", d2);
    }
  }
}

export async function createCustomerOrderFromAbandonedCart(input: {
  organization_id: string;
  customer_name: string;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  state?: string | null;
  delivery_address?: string | null;
  form_id?: string | null;
  agent_id?: number | null;
  order_revenue?: number | null;
  order_cost?: number | null;
  delivery_fee?: number | null;
  amount_paid?: number | null;
  profit?: number | null;
  notes?: string | null;
  abandoned_cart_id: string;
  funnel_name?: string | null;
  offer_name?: string | null;
  sub_brand?: string | null;
  items?: Array<{
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }>;
}) {
  const lineItems = input.items ?? [];
  let orderRevenue = input.order_revenue ?? 0;
  let orderCost = input.order_cost ?? 0;

  if (lineItems.length > 0) {
    orderRevenue = lineItems.reduce(
      (sum, line) => sum + line.unit_price_at_submission * line.quantity,
      0
    );
    orderCost = lineItems.reduce(
      (sum, line) => sum + line.unit_cost_at_submission * line.quantity,
      0
    );
  }

  const deliveryFee = input.delivery_fee ?? 0;
  const profit =
    input.profit ??
    (lineItems.length > 0 ? orderRevenue - orderCost - deliveryFee : null);

  const { data, error } = await supabase
    .from("customer_orders")
    .insert({
      organization_id: input.organization_id,
      form_id: input.form_id,
      agent_id: input.agent_id,
      source: "converted_from_cart",
      status: "new",
      customer_name: input.customer_name,
      phone_number: input.phone_number ?? input.whatsapp_number ?? null,
      state: input.state ?? null,
      delivery_address: input.delivery_address ?? null,
      order_revenue: lineItems.length > 0 ? orderRevenue : input.order_revenue,
      order_cost: lineItems.length > 0 ? orderCost : input.order_cost,
      amount_paid: input.amount_paid ?? (lineItems.length > 0 ? orderRevenue : null),
      delivery_fee: deliveryFee,
      profit,
      notes: input.notes,
      abandoned_cart_id: input.abandoned_cart_id,
      funnel_name: input.funnel_name ?? null,
      offer_name: input.offer_name ?? null,
      sub_brand: input.sub_brand ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const orderId = data.id as string;

  if (lineItems.length > 0) {
    const itemRows = lineItems.map((line) => {
      const total_price = line.unit_price_at_submission * line.quantity;
      const total_cost = line.unit_cost_at_submission * line.quantity;
      return {
        order_id: orderId,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price_at_submission: line.unit_price_at_submission,
        unit_cost_at_submission: line.unit_cost_at_submission,
        total_price,
        total_cost,
        profit: total_price - total_cost,
      };
    });
    const { error: itemErr } = await supabase
      .from("customer_order_items")
      .insert(itemRows);
    if (itemErr) throw itemErr;
    await refreshCustomerOrderTotals(orderId);
  }

  return orderId;
}

function sumOrderItems(items: CustomerOrderItem[]) {
  return items.reduce(
    (acc, it) => ({
      revenue: acc.revenue + (it.total_price || 0),
      cost: acc.cost + (it.total_cost || 0),
      profit: acc.profit + (it.profit || 0),
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );
}

async function refreshCustomerOrderTotals(orderId: string) {
  const { data: items, error: iErr } = await supabase
    .from("customer_order_items")
    .select("*")
    .eq("order_id", orderId);
  if (iErr) throw iErr;

  const mapped: CustomerOrderItem[] = (items || []).map((it: any) => ({
    id: it.id,
    order_id: it.order_id,
    product_id: it.product_id,
    quantity: Number(it.quantity) || 0,
    unit_price_at_submission: Number(it.unit_price_at_submission) || 0,
    unit_cost_at_submission: Number(it.unit_cost_at_submission) || 0,
    total_price: Number(it.total_price) || 0,
    total_cost: Number(it.total_cost) || 0,
    profit: Number(it.profit) || 0,
    created_at: it.created_at,
  }));

  const totals = sumOrderItems(mapped);
  const { data: orderRow, error: oErr } = await supabase
    .from("customer_orders")
    .select("delivery_fee, form_response_id")
    .eq("id", orderId)
    .single();
  if (oErr) throw oErr;

  const deliveryFee = Number(orderRow.delivery_fee) || 0;
  const netProfit = totals.revenue - totals.cost - deliveryFee;

  const { error: uErr } = await supabase
    .from("customer_orders")
    .update({
      order_revenue: totals.revenue,
      order_cost: totals.cost,
      profit: netProfit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (uErr) throw uErr;

  const frId = orderRow.form_response_id as string | null;
  if (frId) {
    await supabase
      .from("form_responses")
      .update({
        order_revenue: totals.revenue,
        order_cost: totals.cost,
        profit: netProfit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", frId);
  }
}

export async function createManualCustomerOrder(input: {
  organization_id: string;
  csr_id?: string | null;
  agent_id?: number | null;
  customer_name: string;
  phone_number?: string | null;
  state?: string | null;
  delivery_address?: string | null;
  delivery_fee?: number | null;
  amount_paid?: number | null;
  money_received_by?: MoneyReceivedBy;
  notes?: string | null;
  funnel_name?: string | null;
  offer_name?: string | null;
  sub_brand?: string | null;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }>;
}): Promise<string> {
  if (!input.items.length) {
    throw new Error("Add at least one product line.");
  }

  const lineTotals = input.items.map((line) => {
    const qty = line.quantity;
    const total_price = line.unit_price_at_submission * qty;
    const total_cost = line.unit_cost_at_submission * qty;
    return {
      ...line,
      total_price,
      total_cost,
      profit: total_price - total_cost,
    };
  });

  const orderRevenue = lineTotals.reduce((s, l) => s + l.total_price, 0);
  const orderCost = lineTotals.reduce((s, l) => s + l.total_cost, 0);
  const deliveryFee = input.delivery_fee ?? 0;
  const moneyReceivedBy = input.money_received_by ?? "agent_collected";

  let csrId = input.csr_id ?? null;
  if (!csrId) {
    csrId = await getNextAssignedUser(input.organization_id);
  }

  const { data: order, error } = await supabase
    .from("customer_orders")
    .insert({
      organization_id: input.organization_id,
      csr_id: csrId,
      agent_id: input.agent_id ?? null,
      source: "manual",
      status: "new",
      customer_name: input.customer_name,
      phone_number: input.phone_number ?? null,
      state: input.state ?? null,
      delivery_address: input.delivery_address ?? null,
      order_revenue: orderRevenue,
      order_cost: orderCost,
      amount_paid: input.amount_paid ?? orderRevenue,
      delivery_fee: deliveryFee,
      profit: 0,
      notes: input.notes ?? null,
      funnel_name: input.funnel_name ?? null,
      offer_name: input.offer_name ?? null,
      sub_brand: input.sub_brand ?? null,
      money_received_by: moneyReceivedBy,
      payment_method: moneyReceivedByToPaymentMethod(moneyReceivedBy),
    })
    .select("id")
    .single();

  if (error) throw error;
  const orderId = order.id as string;

  const itemRows = lineTotals.map((l) => ({
    order_id: orderId,
    product_id: l.product_id,
    quantity: l.quantity,
    unit_price_at_submission: l.unit_price_at_submission,
    unit_cost_at_submission: l.unit_cost_at_submission,
    total_price: l.total_price,
    total_cost: l.total_cost,
    profit: l.profit,
  }));

  const { error: iErr } = await supabase.from("customer_order_items").insert(itemRows);
  if (iErr) throw iErr;

  return orderId;
}

export async function addOrderUpsellLine(
  orderId: string,
  line: {
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }
): Promise<void> {
  const qty = line.quantity;
  if (qty <= 0) throw new Error("Quantity must be positive.");

  const total_price = line.unit_price_at_submission * qty;
  const total_cost = line.unit_cost_at_submission * qty;

  const { error } = await supabase.from("customer_order_items").insert({
    order_id: orderId,
    product_id: line.product_id,
    quantity: qty,
    unit_price_at_submission: line.unit_price_at_submission,
    unit_cost_at_submission: line.unit_cost_at_submission,
    total_price,
    total_cost,
    profit: total_price - total_cost,
  });
  if (error) throw error;

  await refreshCustomerOrderTotals(orderId);
}
