import {
  fetchCustomerOrders,
  updateCustomerOrder,
  deleteCustomerOrderDeep,
  addOrderUpsellLine,
  createManualCustomerOrder,
  advanceOrderStatusApi,
  markOrderFailedDeliveryApi,
} from "./customerOrders";
import { customerOrderToFormResponse } from "../utils/customerOrderAdapters";
import { FormResponseFilters, FormResponseWithItems } from "../types/formResponse";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import { isDeliveredStatus, toDeliveredStatus, normalizeOrderStatus } from "../constants/orderStatus";

/**
 * Simplified vs. the source app: no more form_responses v1/v2 merge (see
 * the Orders port plan - that merge existed for historical data that hasn't
 * been migrated into this Postgres yet, and for a WordPress webhook intake
 * path that isn't ported either; both are out of scope for now).
 * `customer_orders` is the sole source. Every row is still adapted through
 * `customerOrderToFormResponse` so OrdersForm.tsx and its dialog/table
 * subcomponents (built against `FormResponseWithItems`) don't need to
 * change at all.
 *
 * Business rules that used to live here client-side (notes stamping,
 * mark-delivered stock movements, failed-delivery expense creation, status
 * pipeline validation) now live server-side in apps/api's
 * modules/numbatrak-orders/lib/orders.ts - this file is now a thin
 * pass-through + adapter layer.
 */

export type OrderIntakeListParams = {
  organizationId: string;
  filters: FormResponseFilters;
  searchQuery?: string;
};

export type OrderIntakeListResult = {
  rows: FormResponseWithItems[];
  source: "v2";
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

export async function listOrderIntake(params: OrderIntakeListParams): Promise<OrderIntakeListResult> {
  const { organizationId, filters, searchQuery } = params;
  const orders = await fetchCustomerOrders(organizationId, {
    status: filters.status as never,
    form_id: filters.form_id,
    csr_id: filters.csr_id,
    agent_id: filters.agent_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    sub_brand: filters.sub_brand,
    funnel_name: filters.funnel_name,
    offer_name: filters.offer_name,
    search: searchQuery?.trim() || undefined,
  });

  const rows = orders.map(customerOrderToFormResponse) as FormResponseWithItems[];
  return { rows, source: "v2", supportsCsrFilter: true };
}

export async function updateOrderIntake(order: FormResponseWithItems, updates: OrderIntakeUpdate): Promise<void> {
  const orderId = (order as { _customerOrderId?: string })._customerOrderId ?? order.id;
  await updateCustomerOrder(orderId, {
    status: updates.status as never,
    notes: updates.notes,
    delivery_fee: updates.delivery_fee,
    amount_paid: updates.amount_paid,
    agent_id: updates.agent_id,
    money_received_by: updates.money_received_by,
  });
}

export async function updateOrderIntakeNotes(order: FormResponseWithItems, notes: string): Promise<void> {
  return updateOrderIntake(order, { notes });
}

export async function markOrderDelivered(order: FormResponseWithItems): Promise<void> {
  return updateOrderIntake(order, { status: toDeliveredStatus() });
}

export async function advanceOrderStatus(order: FormResponseWithItems): Promise<void> {
  const orderId = (order as { _customerOrderId?: string })._customerOrderId ?? order.id;
  await advanceOrderStatusApi(orderId);
}

export async function markOrderFailedDelivery(
  order: FormResponseWithItems,
  options?: { expenseAmount?: number }
): Promise<void> {
  const orderId = (order as { _customerOrderId?: string })._customerOrderId ?? order.id;
  const expenseAmount = options?.expenseAmount ?? (order.delivery_fee != null ? Number(order.delivery_fee) : 0);
  await markOrderFailedDeliveryApi(orderId, expenseAmount);
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
  const orderId = (order as { _customerOrderId?: string })._customerOrderId ?? order.id;
  await addOrderUpsellLine(orderId, line);
}

export async function createManualOrder(
  input: Parameters<typeof createManualCustomerOrder>[0]
): Promise<string> {
  return createManualCustomerOrder(input);
}

export async function deleteOrderIntake(order: FormResponseWithItems): Promise<void> {
  const orderId = (order as { _customerOrderId?: string })._customerOrderId ?? order.id;
  await deleteCustomerOrderDeep(orderId);
}

export { normalizeOrderStatus };
