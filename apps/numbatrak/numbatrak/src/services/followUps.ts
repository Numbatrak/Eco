"use client";

import { apiRequest } from "../lib/apiClient";
import { FollowUpWithRelations, FollowUpStatus, FollowUpPriority, FollowUpOutcome } from "../types/followUp";
import { emptyWithoutOrg } from "./orgQuery";

interface FollowUpDto {
  id: number;
  orderId: string | null;
  abandonedCartId: string | null;
  assignedTo: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  startedAt: string | null;
  firstContactAt: string | null;
  completedAt: string | null;
  responseTimeMinutes: number | null;
  resolutionTimeMinutes: number | null;
  outcome: FollowUpOutcome | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cartCustomerName: string | null;
  cartCustomerPhone: string | null;
  cartCustomerWhatsapp: string | null;
  cartCustomerLocation: string | null;
  cartCustomerAddress: string | null;
  cartCustomerState: string | null;
}

function fromDto(dto: FollowUpDto): FollowUpWithRelations {
  return {
    id: dto.id,
    order_id: dto.orderId,
    abandoned_cart_id: dto.abandonedCartId,
    assigned_to: dto.assignedTo,
    status: dto.status,
    priority: dto.priority,
    started_at: dto.startedAt,
    first_contact_at: dto.firstContactAt,
    completed_at: dto.completedAt,
    response_time_minutes: dto.responseTimeMinutes,
    resolution_time_minutes: dto.resolutionTimeMinutes,
    outcome: dto.outcome,
    notes: dto.notes,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    assigned_user_name: dto.assignedUserName,
    assigned_user_email: dto.assignedUserEmail,
    // The `orders` table this used to embed is out of scope for this
    // migration (never repointed to customer_orders) - order-linked
    // follow-ups are unreachable in the live app anyway (only the dead
    // legacy OrderTableRow.tsx ever created them). Always null.
    order_customer_name: null,
    order_customer_phone: null,
    order_customer_location: null,
    cart_customer_name: dto.cartCustomerName,
    cart_customer_phone: dto.cartCustomerPhone,
    cart_customer_whatsapp: dto.cartCustomerWhatsapp,
    cart_customer_location: dto.cartCustomerLocation,
    cart_customer_address: dto.cartCustomerAddress,
    cart_customer_state: dto.cartCustomerState,
  };
}

function buildQuery(
  offset: number,
  limit: number,
  sortOrder: "asc" | "desc",
  filters?: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    order_id?: string;
    abandoned_cart_id?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  searchQuery?: string
): string {
  const params = new URLSearchParams();
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  params.set("sortOrder", sortOrder);
  if (searchQuery?.trim()) params.set("search", searchQuery.trim());
  if (filters?.assigned_to) params.set("assignedTo", filters.assigned_to);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.order_id) params.set("orderId", filters.order_id);
  if (filters?.abandoned_cart_id) params.set("abandonedCartId", filters.abandoned_cart_id);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  return `?${params.toString()}`;
}

/**
 * Fetch all follow-ups with pagination and filters (org-scoped). The search
 * filter is server-side (notes only) - client-side enrichment against
 * assignee/customer names is no longer needed since the server already
 * returns those joined in.
 */
export async function fetchFollowUps(
  organizationId: string | null,
  offset: number = 0,
  limit: number = 20,
  sortOrder: "asc" | "desc" = "desc",
  filters?: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    order_id?: string;
    abandoned_cart_id?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  searchQuery?: string
): Promise<FollowUpWithRelations[]> {
  const empty = emptyWithoutOrg<FollowUpWithRelations>(organizationId);
  if (empty) return empty;

  const { followUps } = await apiRequest<{ followUps: FollowUpDto[] }>(
    `/org/numbatrak/follow-ups${buildQuery(offset, limit, sortOrder, filters, searchQuery)}`
  );
  return followUps.map(fromDto);
}

export async function fetchFollowUpsCount(
  organizationId: string | null,
  filters?: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    dateFrom?: string;
    dateTo?: string;
  },
  searchQuery?: string
): Promise<number> {
  if (!organizationId) return 0;

  const params = new URLSearchParams();
  if (searchQuery?.trim()) params.set("search", searchQuery.trim());
  if (filters?.assigned_to) params.set("assignedTo", filters.assigned_to);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);

  const { count } = await apiRequest<{ count: number }>(`/org/numbatrak/follow-ups/count?${params.toString()}`);
  return count;
}

/**
 * Create a new follow-up. Auto-assignment (least-busy csr) happens
 * server-side when assigned_to is omitted.
 */
export async function createFollowUp(input: {
  organization_id: string;
  order_id?: string | null;
  abandoned_cart_id?: string | null;
  assigned_to?: string | null;
  priority?: FollowUpPriority;
  notes?: string | null;
}): Promise<FollowUpWithRelations> {
  const dto = await apiRequest<FollowUpDto>("/org/numbatrak/follow-ups", {
    method: "POST",
    body: {
      orderId: input.order_id,
      abandonedCartId: input.abandoned_cart_id,
      assignedTo: input.assigned_to,
      priority: input.priority,
      notes: input.notes,
    },
  });
  return fromDto(dto);
}

/**
 * Update follow-up status. Response/resolution-time work-hours math and the
 * resolved-requires-outcome validation now happen server-side.
 */
export async function updateFollowUp(
  id: number,
  updates: {
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    first_contact_at?: string | null;
    completed_at?: string | null;
    outcome?: FollowUpOutcome | null;
    notes?: string | null;
    assigned_to?: string | null;
  }
): Promise<FollowUpWithRelations> {
  const dto = await apiRequest<FollowUpDto>(`/org/numbatrak/follow-ups/${id}`, {
    method: "PATCH",
    body: {
      status: updates.status,
      priority: updates.priority,
      firstContactAt: updates.first_contact_at,
      completedAt: updates.completed_at,
      outcome: updates.outcome,
      notes: updates.notes,
      assignedTo: updates.assigned_to,
    },
  });
  return fromDto(dto);
}

export async function removeFollowUp(id: number): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/follow-ups/${id}`, { method: "DELETE" });
}

export async function getFollowUpsForOrder(
  organizationId: string,
  orderId: string
): Promise<FollowUpWithRelations[]> {
  return fetchFollowUps(organizationId, 0, 100, "desc", { order_id: orderId });
}

export async function getFollowUpsForCart(
  organizationId: string,
  cartId: string
): Promise<FollowUpWithRelations[]> {
  return fetchFollowUps(organizationId, 0, 100, "desc", {
    abandoned_cart_id: cartId,
  });
}

/**
 * Close open follow-ups when an abandoned cart converts to an order - now a
 * single atomic server-side call instead of a fetch-then-update-each loop.
 */
export async function resolveFollowUpsForConvertedCart(
  organizationId: string,
  cartId: string,
  customerOrderId?: string
): Promise<void> {
  void organizationId;
  await apiRequest<void>("/org/numbatrak/follow-ups/resolve-for-cart", {
    method: "POST",
    body: { cartId, orderId: customerOrderId },
  });
}
