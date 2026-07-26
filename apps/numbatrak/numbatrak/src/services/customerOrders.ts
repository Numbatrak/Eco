"use client";

import { apiRequest } from "../lib/apiClient";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import {
  CustomerOrderWithRelations,
  CustomerOrderItem,
  CustomerOrderFilters,
  CustomerOrderStatus,
} from "../types/customerOrder";
import { emptyWithoutOrg } from "./orgQuery";

/** Wire shape returned by apps/api's /org/numbatrak/orders* routes (camelCase). */
interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtSubmission: string;
  unitCostAtSubmission: string;
  totalPrice: string;
  totalCost: string;
  profit: string;
  createdAt: string | null;
}

interface OrderDto {
  id: string;
  csrId: string | null;
  agentId: number | null;
  status: string;
  source: string;
  customerName: string | null;
  phoneNumber: string | null;
  state: string | null;
  deliveryAddress: string | null;
  orderRevenue: string | null;
  orderCost: string | null;
  amountPaid: string | null;
  deliveryFee: string | null;
  profit: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  offerName: string | null;
  funnelName: string | null;
  subBrand: string | null;
  moneyReceivedBy: MoneyReceivedBy;
  items: OrderItemDto[];
  csr: { id: string; fullName: string | null; email: string | null } | null;
  agent: { id: number; name: string } | null;
  productNames: Record<string, string>;
}

function itemFromDto(dto: OrderItemDto): CustomerOrderItem {
  return {
    id: dto.id,
    order_id: dto.orderId,
    product_id: dto.productId,
    quantity: dto.quantity,
    unit_price_at_submission: Number(dto.unitPriceAtSubmission),
    unit_cost_at_submission: Number(dto.unitCostAtSubmission),
    total_price: Number(dto.totalPrice),
    total_cost: Number(dto.totalCost),
    profit: Number(dto.profit),
    created_at: dto.createdAt,
  };
}

function orderFromDto(dto: OrderDto, organizationId: string): CustomerOrderWithRelations {
  return {
    id: dto.id,
    organization_id: organizationId,
    // form_response_id / abandoned_cart_id: always null for this slice - no
    // form_responses merge, no abandoned-cart conversion yet (see plan).
    form_response_id: null,
    form_id: null,
    csr_id: dto.csrId,
    agent_id: dto.agentId,
    status: dto.status as CustomerOrderStatus,
    source: dto.source as CustomerOrderWithRelations["source"],
    customer_name: dto.customerName,
    phone_number: dto.phoneNumber,
    state: dto.state,
    delivery_address: dto.deliveryAddress,
    order_revenue: dto.orderRevenue != null ? Number(dto.orderRevenue) : null,
    order_cost: dto.orderCost != null ? Number(dto.orderCost) : null,
    amount_paid: dto.amountPaid != null ? Number(dto.amountPaid) : null,
    delivery_fee: dto.deliveryFee != null ? Number(dto.deliveryFee) : null,
    profit: dto.profit != null ? Number(dto.profit) : null,
    notes: dto.notes,
    abandoned_cart_id: null,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    completed_at: dto.completedAt,
    offer_name: dto.offerName,
    funnel_name: dto.funnelName,
    sub_brand: dto.subBrand,
    money_received_by: dto.moneyReceivedBy,
    items: dto.items.map(itemFromDto),
    csr: dto.csr ? { id: dto.csr.id, full_name: dto.csr.fullName, email: dto.csr.email } : null,
    form: null,
    agent: dto.agent,
    productNames: dto.productNames,
  };
}

function buildQuery(filters: CustomerOrderFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.form_id) params.set("formId", filters.form_id);
  if (filters.csr_id) params.set("csrId", filters.csr_id);
  if (filters.agent_id != null) params.set("agentId", String(filters.agent_id));
  if (filters.date_from) params.set("dateFrom", filters.date_from);
  if (filters.date_to) params.set("dateTo", filters.date_to);
  if (filters.sub_brand) params.set("subBrand", filters.sub_brand);
  if (filters.funnel_name) params.set("funnelName", filters.funnel_name);
  if (filters.offer_name) params.set("offerName", filters.offer_name);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchCustomerOrders(
  organizationId: string | null,
  filters: CustomerOrderFilters = {}
): Promise<CustomerOrderWithRelations[]> {
  const empty = emptyWithoutOrg<CustomerOrderWithRelations>(organizationId);
  if (empty) return empty;

  const { orders } = await apiRequest<{ orders: OrderDto[] }>(
    `/org/numbatrak/orders${buildQuery(filters)}`
  );
  return orders.map((o) => orderFromDto(o, organizationId!));
}

export async function updateCustomerOrder(
  orderId: string,
  updates: Partial<{
    status: CustomerOrderStatus;
    notes: string | null;
    delivery_fee: number | null;
    amount_paid: number | null;
    agent_id: number | null;
    money_received_by: MoneyReceivedBy;
  }>
): Promise<void> {
  await apiRequest<OrderDto>(`/org/numbatrak/orders/${orderId}`, {
    method: "PATCH",
    body: {
      status: updates.status,
      notes: updates.notes,
      deliveryFee: updates.delivery_fee,
      amountPaid: updates.amount_paid,
      agentId: updates.agent_id,
      moneyReceivedBy: updates.money_received_by,
    },
  });
}

export async function deleteCustomerOrder(orderId: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/orders/${orderId}`, { method: "DELETE" });
}

/** No form_responses linkage in this slice - a plain delete. Kept as a
 * distinct export so orderIntake.ts's call site doesn't need to change. */
export async function deleteCustomerOrderDeep(orderId: string): Promise<void> {
  await deleteCustomerOrder(orderId);
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

  const dto = await apiRequest<OrderDto>("/org/numbatrak/orders", {
    method: "POST",
    body: {
      csrId: input.csr_id ?? null,
      agentId: input.agent_id ?? null,
      customerName: input.customer_name,
      phoneNumber: input.phone_number ?? null,
      state: input.state ?? null,
      deliveryAddress: input.delivery_address ?? null,
      deliveryFee: input.delivery_fee ?? null,
      amountPaid: input.amount_paid ?? null,
      moneyReceivedBy: input.money_received_by ?? "agent_collected",
      notes: input.notes ?? null,
      funnelName: input.funnel_name ?? null,
      offerName: input.offer_name ?? null,
      subBrand: input.sub_brand ?? null,
      items: input.items.map((line) => ({
        productId: line.product_id,
        quantity: line.quantity,
        unitPriceAtSubmission: line.unit_price_at_submission,
        unitCostAtSubmission: line.unit_cost_at_submission,
      })),
    },
  });
  return dto.id;
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
  await apiRequest<OrderDto>(`/org/numbatrak/orders/${orderId}/upsell`, {
    method: "POST",
    body: {
      productId: line.product_id,
      quantity: line.quantity,
      unitPriceAtSubmission: line.unit_price_at_submission,
      unitCostAtSubmission: line.unit_cost_at_submission,
    },
  });
}

export async function advanceOrderStatusApi(orderId: string): Promise<void> {
  await apiRequest<OrderDto>(`/org/numbatrak/orders/${orderId}/advance-status`, { method: "POST" });
}

export async function markOrderFailedDeliveryApi(orderId: string, expenseAmount?: number): Promise<void> {
  await apiRequest<OrderDto>(`/org/numbatrak/orders/${orderId}/mark-failed`, {
    method: "POST",
    body: { expenseAmount },
  });
}

/**
 * Conversion (pricing resolution, order+items insert, marking the cart
 * converted) now happens atomically server-side in one call - the cart id
 * is the only input actually needed. `_input`'s other fields (customer
 * snapshot, pre-priced lines, etc.) were only ever derived from the cart
 * itself client-side, so they're superseded rather than forwarded.
 */
export async function createCustomerOrderFromAbandonedCart(input: { abandoned_cart_id: string }): Promise<string> {
  const dto = await apiRequest<OrderDto>(`/org/numbatrak/abandoned-carts/${input.abandoned_cart_id}/convert`, {
    method: "POST",
  });
  return dto.id;
}
