"use client";

import { supabase } from "../supabaseClient";
import { emptyWithoutOrg } from "./orgQuery";
import {
  WalletSourceOrder,
  WalletRemittanceLine,
  WalletSummary,
  RemittanceLineStatus,
} from "../types/wallet";
import type { PaymentMethod } from "../types/wallet";
import {
  entersWalletRemittance,
  inferMoneyReceivedBy,
} from "../constants/orderAttribution";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import { resolveDateRange, withinDateRange, DateFilter } from "../utils/dateRange";
import { DELIVERED_STATUSES } from "../constants/orderStatus";
import { createUnifiedExpense } from "./unifiedExpenses";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deliveredValue(row: {
  order_revenue: unknown;
  amount_paid: unknown;
}): number {
  const paid = row.amount_paid != null ? num(row.amount_paid) : null;
  if (paid != null && paid > 0) return paid;
  return num(row.order_revenue);
}

export function remittanceLineKey(agentId: number, date: string): string {
  return `${agentId}:${date}`;
}

export function toRemittanceCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function computeExpectedRemittance(input: {
  totalDeliveredValue: number;
  totalDeliveryFees: number;
  netOffAmount: number;
}): number {
  return (
    input.totalDeliveredValue -
    input.totalDeliveryFees -
    input.netOffAmount
  );
}

export function computeRemittanceLineStatus(input: {
  expectedRemittance: number;
  actualAmount: number | null;
}): RemittanceLineStatus {
  if (input.expectedRemittance < 0) return "net_owed";
  if (input.actualAmount == null) return "standing";
  if (input.actualAmount >= input.expectedRemittance) return "remitted";
  return "short";
}

type PersistedLineRow = {
  id: string;
  organization_id: string;
  agent_id: number;
  remittance_date: string;
  total_delivered_value: number;
  total_delivery_fees: number;
  net_off_amount: number;
  expected_remittance: number;
  actual_amount: number | null;
  status: RemittanceLineStatus;
  net_off_expense_id: string | null;
  notes: string | null;
  remitted_at: string | null;
};

function mapSourceOrder(
  row: Record<string, unknown>,
  agentNames: Map<number, string>
): WalletSourceOrder | null {
  const agentId = row.agent_id != null ? Number(row.agent_id) : null;
  if (agentId == null) return null;

  const moneyReceivedBy = inferMoneyReceivedBy(
    row.money_received_by as MoneyReceivedBy | null | undefined,
    (row.payment_method as PaymentMethod) ?? undefined
  );
  if (!entersWalletRemittance(moneyReceivedBy)) return null;

  const completedAt = (row.completed_at as string) ?? null;
  if (!completedAt) return null;

  return {
    id: String(row.id),
    source:
      (row._source as "customer_orders" | "form_responses") ?? "customer_orders",
    customer_name: (row.customer_name as string) ?? null,
    phone_number: (row.phone_number as string) ?? null,
    agent_id: agentId,
    agent_name: agentNames.get(agentId) ?? null,
    order_revenue: num(row.order_revenue),
    amount_paid: row.amount_paid != null ? num(row.amount_paid) : null,
    delivery_fee: num(row.delivery_fee),
    delivered_value: deliveredValue(row),
    sub_brand: (row.sub_brand as string) ?? null,
    payment_method: (row.payment_method as PaymentMethod) ?? "cod",
    money_received_by: moneyReceivedBy,
    wallet_status: (row.wallet_status as WalletSourceOrder["wallet_status"]) ?? null,
    completed_at: completedAt,
  };
}

async function loadAgentNames(
  organizationId: string,
  agentIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!agentIds.length) return map;
  const { data } = await supabase
    .from("agents")
    .select("id, name")
    .eq("organization_id", organizationId)
    .in("id", agentIds);
  (data || []).forEach((a: { id: number; name: string }) => {
    map.set(a.id, a.name);
  });
  return map;
}

const ORDER_SELECT =
  "id, customer_name, phone_number, agent_id, order_revenue, amount_paid, delivery_fee, payment_method, money_received_by, wallet_status, completed_at, sub_brand";

async function fetchSourceOrdersFromCustomerOrders(
  organizationId: string
): Promise<WalletSourceOrder[] | null> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select(ORDER_SELECT)
    .eq("organization_id", organizationId)
    .in("status", [...DELIVERED_STATUSES])
    .not("agent_id", "is", null)
    .order("completed_at", { ascending: false });

  if (error) {
    if (error.message?.includes("delivery_fee") || error.code === "42703") {
      return null;
    }
    throw error;
  }

  const agentIds = [
    ...new Set(
      (data || [])
        .map((r: { agent_id: number | null }) => r.agent_id)
        .filter((id): id is number => id != null)
    ),
  ];
  const agentNames = await loadAgentNames(organizationId, agentIds);

  return (data || [])
    .map((row) =>
      mapSourceOrder(
        { ...(row as Record<string, unknown>), _source: "customer_orders" },
        agentNames
      )
    )
    .filter((o): o is WalletSourceOrder => o != null);
}

async function fetchSourceOrdersFromFormResponses(
  organizationId: string
): Promise<WalletSourceOrder[]> {
  const { data, error } = await supabase
    .from("form_responses")
    .select(ORDER_SELECT)
    .eq("organization_id", organizationId)
    .eq("response_type", "order")
    .in("status", [...DELIVERED_STATUSES])
    .not("agent_id", "is", null)
    .order("completed_at", { ascending: false });

  if (error) throw error;

  const agentIds = [
    ...new Set(
      (data || [])
        .map((r: { agent_id: number | null }) => r.agent_id)
        .filter((id): id is number => id != null)
    ),
  ];
  const agentNames = await loadAgentNames(organizationId, agentIds);

  return (data || [])
    .map((row) =>
      mapSourceOrder(
        { ...(row as Record<string, unknown>), _source: "form_responses" },
        agentNames
      )
    )
    .filter((o): o is WalletSourceOrder => o != null);
}

export async function fetchWalletSourceOrders(
  organizationId: string | null
): Promise<WalletSourceOrder[]> {
  const empty = emptyWithoutOrg<WalletSourceOrder>(organizationId);
  if (empty) return empty;

  const fromV2 = await fetchSourceOrdersFromCustomerOrders(organizationId);
  if (fromV2 === null) {
    return fetchSourceOrdersFromFormResponses(organizationId);
  }
  if (fromV2.length > 0) return fromV2;
  return fetchSourceOrdersFromFormResponses(organizationId);
}

async function fetchPersistedRemittanceLines(
  organizationId: string
): Promise<Map<string, PersistedLineRow>> {
  const { data, error } = await supabase
    .from("wallet_remittance_lines")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    if (
      error.message?.includes("wallet_remittance_lines") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return new Map();
    }
    throw error;
  }

  const map = new Map<string, PersistedLineRow>();
  for (const row of data || []) {
    const r = row as Record<string, unknown>;
    const date = String(r.remittance_date).slice(0, 10);
    const agentId = Number(r.agent_id);
    const key = remittanceLineKey(agentId, date);
    map.set(key, {
      id: String(r.id),
      organization_id: String(r.organization_id),
      agent_id: agentId,
      remittance_date: date,
      total_delivered_value: num(r.total_delivered_value),
      total_delivery_fees: num(r.total_delivery_fees),
      net_off_amount: num(r.net_off_amount),
      expected_remittance: num(r.expected_remittance),
      actual_amount: r.actual_amount != null ? num(r.actual_amount) : null,
      status: r.status as RemittanceLineStatus,
      net_off_expense_id: (r.net_off_expense_id as string) ?? null,
      notes: (r.notes as string) ?? null,
      remitted_at: (r.remitted_at as string) ?? null,
    });
  }
  return map;
}

export function aggregateRemittanceLines(
  organizationId: string,
  orders: WalletSourceOrder[],
  persisted: Map<string, PersistedLineRow>,
  agentNames: Map<number, string>
): WalletRemittanceLine[] {
  const groups = new Map<string, WalletSourceOrder[]>();

  for (const order of orders) {
    const date = toRemittanceCalendarDate(order.completed_at);
    if (!date) continue;
    const key = remittanceLineKey(order.agent_id, date);
    const list = groups.get(key) ?? [];
    list.push(order);
    groups.set(key, list);
  }

  const lines: WalletRemittanceLine[] = [];

  for (const [, lineOrders] of groups) {
    const agentId = lineOrders[0].agent_id;
    const date = toRemittanceCalendarDate(lineOrders[0].completed_at)!;
    const key = remittanceLineKey(agentId, date);
    const totalDeliveredValue = lineOrders.reduce(
      (s, o) => s + o.delivered_value,
      0
    );
    const totalDeliveryFees = lineOrders.reduce((s, o) => s + o.delivery_fee, 0);
    const subBrands = [
      ...new Set(
        lineOrders.map((o) => o.sub_brand?.trim()).filter(Boolean) as string[]
      ),
    ].sort();

    const saved = persisted.get(key);
    const netOffAmount = saved?.net_off_amount ?? 0;
    const expectedRemittance = computeExpectedRemittance({
      totalDeliveredValue,
      totalDeliveryFees,
      netOffAmount,
    });
    const actualAmount = saved?.actual_amount ?? null;
    const status = computeRemittanceLineStatus({
      expectedRemittance,
      actualAmount,
    });
    const shortfall =
      actualAmount != null && status === "short"
        ? Math.max(0, expectedRemittance - actualAmount)
        : 0;

    lines.push({
      lineKey: key,
      id: saved?.id ?? null,
      organization_id: organizationId,
      agent_id: agentId,
      agent_name:
        lineOrders[0].agent_name ?? agentNames.get(agentId) ?? `Agent #${agentId}`,
      remittance_date: date,
      order_count: lineOrders.length,
      orders: lineOrders,
      sub_brands: subBrands,
      total_delivered_value: totalDeliveredValue,
      total_delivery_fees: totalDeliveryFees,
      net_off_amount: netOffAmount,
      expected_remittance: expectedRemittance,
      actual_amount: actualAmount,
      status,
      shortfall,
      net_off_expense_id: saved?.net_off_expense_id ?? null,
      notes: saved?.notes ?? null,
      remitted_at: saved?.remitted_at ?? null,
    });
  }

  return lines.sort((a, b) => {
    const dateCmp = b.remittance_date.localeCompare(a.remittance_date);
    if (dateCmp !== 0) return dateCmp;
    return a.agent_name.localeCompare(b.agent_name);
  });
}

export async function fetchWalletRemittanceLines(
  organizationId: string | null
): Promise<WalletRemittanceLine[]> {
  const empty = emptyWithoutOrg<WalletRemittanceLine>(organizationId);
  if (empty) return empty;

  const [orders, persisted] = await Promise.all([
    fetchWalletSourceOrders(organizationId),
    fetchPersistedRemittanceLines(organizationId),
  ]);

  const agentIds = [...new Set(orders.map((o) => o.agent_id))];
  const agentNames = await loadAgentNames(organizationId, agentIds);

  return aggregateRemittanceLines(
    organizationId,
    orders,
    persisted,
    agentNames
  );
}

export function computeWalletSummary(
  lines: WalletRemittanceLine[],
  dateFilter?: DateFilter
): WalletSummary {
  const { startDate, endDate } = resolveDateRange(dateFilter);
  const inPeriod = lines.filter((line) =>
    withinDateRange(`${line.remittance_date}T12:00:00.000Z`, startDate, endDate)
  );

  let orderCount = 0;
  let totalDeliveredValue = 0;
  let totalDeliveryFees = 0;
  let totalExpectedRemittance = 0;
  let totalRemitted = 0;
  let cashGapOutstanding = 0;
  let standingCount = 0;
  let shortCount = 0;
  let remittedCount = 0;

  for (const line of inPeriod) {
    orderCount += line.order_count;
    totalDeliveredValue += line.total_delivered_value;
    totalDeliveryFees += line.total_delivery_fees;
    totalExpectedRemittance += Math.max(0, line.expected_remittance);

    switch (line.status) {
      case "standing":
        standingCount += 1;
        cashGapOutstanding += line.expected_remittance;
        break;
      case "short":
        shortCount += 1;
        totalRemitted += line.actual_amount ?? 0;
        cashGapOutstanding += line.shortfall;
        break;
      case "remitted":
        remittedCount += 1;
        totalRemitted += line.actual_amount ?? line.expected_remittance;
        break;
      case "net_owed":
        standingCount += 1;
        break;
    }
  }

  return {
    lineCount: inPeriod.length,
    orderCount,
    totalDeliveredValue,
    totalDeliveryFees,
    totalExpectedRemittance,
    totalRemitted,
    cashGapOutstanding: Math.max(0, cashGapOutstanding),
    standingCount,
    shortCount,
    remittedCount,
  };
}

export function filterRemittanceLines(
  lines: WalletRemittanceLine[],
  options: {
    dateFilter?: DateFilter;
    statusFilter?: "all" | RemittanceLineStatus;
    agentId?: number | null;
    subBrand?: string | null;
    search?: string;
  }
): WalletRemittanceLine[] {
  const { startDate, endDate } = resolveDateRange(options.dateFilter);
  const q = options.search?.trim().toLowerCase();

  return lines.filter((line) => {
    if (
      !withinDateRange(`${line.remittance_date}T12:00:00.000Z`, startDate, endDate)
    ) {
      return false;
    }
    if (
      options.statusFilter &&
      options.statusFilter !== "all" &&
      line.status !== options.statusFilter
    ) {
      return false;
    }
    if (options.agentId != null && line.agent_id !== options.agentId) {
      return false;
    }
    if (options.subBrand && !line.sub_brands.includes(options.subBrand)) {
      return false;
    }
    if (q) {
      const hay = [line.agent_name, line.remittance_date, ...line.sub_brands]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

async function syncOrdersRemittanceStatus(
  orders: WalletSourceOrder[],
  userId: string
): Promise<void> {
  const payload = {
    wallet_status: "collected" as const,
    remittance_confirmed_at: new Date().toISOString(),
    remittance_confirmed_by: userId,
  };

  for (const order of orders) {
    const table =
      order.source === "customer_orders" ? "customer_orders" : "form_responses";
    await supabase.from(table).update(payload).eq("id", order.id);

    if (table === "customer_orders") {
      const { data: linked } = await supabase
        .from("customer_orders")
        .select("form_response_id")
        .eq("id", order.id)
        .maybeSingle();
      if (linked?.form_response_id) {
        await supabase
          .from("form_responses")
          .update(payload)
          .eq("id", linked.form_response_id);
      }
    }
  }
}

export async function recordRemittance(
  line: WalletRemittanceLine,
  actualAmount: number,
  userId: string
): Promise<WalletRemittanceLine> {
  if (actualAmount < 0) {
    throw new Error("Actual amount cannot be negative.");
  }

  const status = computeRemittanceLineStatus({
    expectedRemittance: line.expected_remittance,
    actualAmount,
  });

  const payload = {
    organization_id: line.organization_id,
    agent_id: line.agent_id,
    remittance_date: line.remittance_date,
    total_delivered_value: line.total_delivered_value,
    total_delivery_fees: line.total_delivery_fees,
    net_off_amount: line.net_off_amount,
    expected_remittance: line.expected_remittance,
    actual_amount: actualAmount,
    status,
    remitted_at: new Date().toISOString(),
    remitted_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("wallet_remittance_lines")
    .upsert(payload, { onConflict: "organization_id,agent_id,remittance_date" })
    .select("*")
    .single();

  if (error) throw error;

  if (status === "remitted") {
    await syncOrdersRemittanceStatus(line.orders, userId);
  }

  const shortfall =
    status === "short"
      ? Math.max(0, line.expected_remittance - actualAmount)
      : 0;

  return {
    ...line,
    id: String((data as { id: string }).id),
    actual_amount: actualAmount,
    status,
    shortfall,
    remitted_at: payload.remitted_at,
  };
}

export async function addNetOffToLine(
  line: WalletRemittanceLine,
  amount: number,
  userId: string,
  note?: string
): Promise<WalletRemittanceLine> {
  if (amount <= 0) {
    throw new Error("Net-off amount must be positive.");
  }

  const newNetOff = line.net_off_amount + amount;
  const expectedRemittance = computeExpectedRemittance({
    totalDeliveredValue: line.total_delivered_value,
    totalDeliveryFees: line.total_delivery_fees,
    netOffAmount: newNetOff,
  });

  const expense = await createUnifiedExpense({
    organization_id: line.organization_id,
    scope: "agent",
    category: "operational",
    subcategory: "agent_remittance_net_off",
    amount,
    agent_id: line.agent_id,
    note:
      note?.trim() ||
      `Net-off on remittance ${line.agent_name} ${line.remittance_date}`,
    occurred_at: `${line.remittance_date}T12:00:00.000Z`,
    created_by: userId,
    source_type: "wallet_net_off",
    source_id: `${line.id}:${newNetOff}`,
    skip_attribution_validation: true,
  });

  const status = computeRemittanceLineStatus({
    expectedRemittance,
    actualAmount: line.actual_amount,
  });

  const payload = {
    organization_id: line.organization_id,
    agent_id: line.agent_id,
    remittance_date: line.remittance_date,
    total_delivered_value: line.total_delivered_value,
    total_delivery_fees: line.total_delivery_fees,
    net_off_amount: newNetOff,
    expected_remittance: expectedRemittance,
    actual_amount: line.actual_amount,
    status,
    net_off_expense_id: expense.id,
    notes: line.notes,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("wallet_remittance_lines")
    .upsert(payload, { onConflict: "organization_id,agent_id,remittance_date" })
    .select("*")
    .single();

  if (error) throw error;

  return {
    ...line,
    id: String((data as { id: string }).id),
    net_off_amount: newNetOff,
    expected_remittance: expectedRemittance,
    status,
    net_off_expense_id: expense.id,
    shortfall:
      line.actual_amount != null && status === "short"
        ? Math.max(0, expectedRemittance - line.actual_amount)
        : 0,
  };
}

export function collectWalletSubBrands(
  lines: WalletRemittanceLine[]
): string[] {
  const set = new Set<string>();
  for (const line of lines) {
    for (const b of line.sub_brands) set.add(b);
  }
  return [...set].sort();
}

/** @deprecated Use fetchWalletRemittanceLines */
export async function fetchWalletOrders(organizationId: string | null) {
  const orders = await fetchWalletSourceOrders(organizationId);
  return orders.map((o) => ({
    id: o.id,
    source: o.source,
    customer_name: o.customer_name,
    phone_number: o.phone_number,
    agent_id: o.agent_id,
    agent_name: o.agent_name,
    order_revenue: o.order_revenue,
    amount_paid: o.amount_paid,
    payment_method: o.payment_method,
    money_received_by: o.money_received_by,
    wallet_status: o.wallet_status,
    completed_at: o.completed_at,
    remittance_confirmed_at: null,
    released_at: null,
  }));
}
