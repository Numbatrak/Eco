import {
  fetchFormResponses,
  updateFormResponse,
  deleteFormResponse,
} from "./formResponses";
import {
  fetchCustomerOrders,
  updateCustomerOrder,
  deleteCustomerOrderDeep,
  addOrderUpsellLine,
  createManualCustomerOrder,
} from "./customerOrders";
import {
  customerOrderToFormResponse,
  AugmentedFormResponse,
} from "../utils/customerOrderAdapters";
import { FormResponseFilters, FormResponseWithItems } from "../types/formResponse";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import { moneyReceivedByToPaymentMethod } from "../constants/orderAttribution";
import { isCustomerOrdersAvailable } from "./orderDataSource";
import {
  isDeliveredStatus,
  toDeliveredStatus,
  getNextStatus,
  normalizeOrderStatus,
} from "../constants/orderStatus";
import { mergeOrderNotesOnSave } from "../utils/orderNotes";
import {
  assertCanMarkDelivered,
  ensureDeliveryStockMovements,
  recordFailedDeliveryExpense,
} from "./orderDelivery";

export type OrderIntakeSource = "v2" | "v1" | "merged";

export type OrderIntakeListParams = {
  organizationId: string;
  filters: FormResponseFilters;
  searchQuery?: string;
};

export type OrderIntakeListResult = {
  rows: FormResponseWithItems[];
  source: OrderIntakeSource;
  supportsCsrFilter: boolean;
};

export type OrderIntakeUpdate = {
  status?: string;
  notes?: string;
  delivery_fee?: number | null;
  amount_paid?: number | null;
  agent_id?: number | null;
  money_received_by?: MoneyReceivedBy;
};

export async function listOrderIntake(
  params: OrderIntakeListParams
): Promise<OrderIntakeListResult> {
  const { organizationId, filters, searchQuery } = params;
  const search = searchQuery?.trim() || undefined;
  const v2Filters = {
    status: filters.status as any,
    form_id: filters.form_id,
    csr_id: filters.csr_id,
    agent_id: filters.agent_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    sub_brand: filters.sub_brand,
    funnel_name: filters.funnel_name,
    offer_name: filters.offer_name,
    search,
  };

  const v2Available = await isCustomerOrdersAvailable(organizationId);

  if (v2Available) {
    const v2 = await fetchCustomerOrders(organizationId, v2Filters);
    const linkedFrIds = new Set(
      v2
        .map((o) => o.form_response_id)
        .filter((id): id is string => id != null)
    );

    const legacyFilters: FormResponseFilters = { ...filters, search };
    const legacyRows = await fetchFormResponses(organizationId, legacyFilters);
    const orphans = legacyRows.filter((r) => !linkedFrIds.has(r.id));

    const merged = [
      ...v2.map(customerOrderToFormResponse),
      ...orphans,
    ] as FormResponseWithItems[];

    merged.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    return {
      rows: merged,
      source: orphans.length > 0 ? "merged" : "v2",
      supportsCsrFilter: true,
    };
  }

  const rows = await fetchFormResponses(organizationId, { ...filters, search });
  return {
    rows,
    source: "v1",
    supportsCsrFilter: true,
  };
}

function resolveOrderIds(order: FormResponseWithItems) {
  const maybeV2 = order as AugmentedFormResponse;
  return {
    customerOrderId: maybeV2._customerOrderId as string | undefined,
    stockOrderId: (maybeV2._customerOrderId || order.id) as string,
    organizationId: order.organization_id,
  };
}

async function applyDeliveredSideEffects(
  order: FormResponseWithItems,
  agentId: number
): Promise<void> {
  const { stockOrderId, organizationId } = resolveOrderIds(order);
  await ensureDeliveryStockMovements({
    organization_id: organizationId,
    order_id: stockOrderId,
    agent_id: agentId,
    items: order.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_cost_at_submission: i.unit_cost_at_submission,
    })),
  });
}

export async function updateOrderIntake(
  order: FormResponseWithItems,
  updates: OrderIntakeUpdate
): Promise<void> {
  const stampedNotes =
    updates.notes !== undefined
      ? mergeOrderNotesOnSave(order.notes, updates.notes)
      : undefined;

  const payload: OrderIntakeUpdate = {
    ...updates,
    ...(stampedNotes !== undefined ? { notes: stampedNotes } : {}),
  };

  const nextStatus = payload.status;
  const becomingDelivered =
    nextStatus != null &&
    isDeliveredStatus(nextStatus) &&
    !isDeliveredStatus(order.status);

  if (becomingDelivered) {
    const agentId = payload.agent_id ?? order.agent_id;
    assertCanMarkDelivered({ status: order.status, agent_id: agentId });
    payload.status = toDeliveredStatus();
    await applyDeliveredSideEffects(order, agentId!);
  }

  const maybeV2 = order as AugmentedFormResponse;
  if (maybeV2._customerOrderId) {
    const v2Updates: Parameters<typeof updateCustomerOrder>[1] = {
      status: payload.status as any,
      notes: payload.notes,
      delivery_fee: payload.delivery_fee,
      amount_paid: payload.amount_paid,
      agent_id: payload.agent_id ?? null,
      money_received_by: payload.money_received_by,
    };
    if (becomingDelivered) {
      v2Updates.completed_at = new Date().toISOString();
    }
    await updateCustomerOrder(maybeV2._customerOrderId, v2Updates);
    return;
  }

  const legacyUpdates: Record<string, unknown> = { ...payload };
  if (payload.money_received_by != null) {
    legacyUpdates.payment_method = moneyReceivedByToPaymentMethod(
      payload.money_received_by
    );
  }
  if (becomingDelivered) {
    legacyUpdates.completed_at = new Date().toISOString();
  }
  await updateFormResponse(order.id, legacyUpdates as any);
}

export async function updateOrderIntakeNotes(
  order: FormResponseWithItems,
  notes: string
): Promise<void> {
  const stamped = mergeOrderNotesOnSave(order.notes, notes);
  if (stamped === undefined) return;
  return updateOrderIntake(order, { notes: stamped });
}

export async function markOrderDelivered(
  order: FormResponseWithItems
): Promise<void> {
  return updateOrderIntake(order, { status: toDeliveredStatus() });
}

export async function advanceOrderStatus(
  order: FormResponseWithItems
): Promise<void> {
  const next = getNextStatus(order.status);
  if (!next) {
    throw new Error("No further status to advance.");
  }
  return updateOrderIntake(order, { status: next });
}

export async function markOrderFailedDelivery(
  order: FormResponseWithItems,
  options?: { expenseAmount?: number; userId?: string | null }
): Promise<void> {
  if (isDeliveredStatus(order.status)) {
    throw new Error("Cannot mark a delivered order as failed.");
  }

  const expenseAmount =
    options?.expenseAmount ??
    (order.delivery_fee != null ? Number(order.delivery_fee) : 0);

  await updateOrderIntake(order, { status: "failed" });

  const { stockOrderId, organizationId } = resolveOrderIds(order);
  const primaryProductId = order.items?.[0]?.product_id ?? null;

  await recordFailedDeliveryExpense({
    organization_id: organizationId,
    order_id: stockOrderId,
    agent_id: order.agent_id,
    amount: expenseAmount,
    product_id: primaryProductId,
    note: `Failed delivery — ${order.customer_name || "order"}`,
    created_by: options?.userId ?? null,
  });
}

export async function addOrderUpsell(
  order: FormResponseWithItems,
  line: {
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }
): Promise<void> {
  if (isDeliveredStatus(order.status)) {
    throw new Error("Cannot add upsell to a delivered order.");
  }
  const maybeV2 = order as AugmentedFormResponse;
  if (!maybeV2._customerOrderId) {
    throw new Error("Upsell is only supported on migrated customer orders.");
  }
  await addOrderUpsellLine(maybeV2._customerOrderId, line);
}

export async function createManualOrder(
  input: Parameters<typeof createManualCustomerOrder>[0]
): Promise<string> {
  return createManualCustomerOrder(input);
}

export async function deleteOrderIntake(order: FormResponseWithItems): Promise<void> {
  const maybeV2 = order as AugmentedFormResponse;
  if (maybeV2._customerOrderId) {
    await deleteCustomerOrderDeep(maybeV2._customerOrderId);
    return;
  }
  await deleteFormResponse(order.id);
}

export { normalizeOrderStatus };
