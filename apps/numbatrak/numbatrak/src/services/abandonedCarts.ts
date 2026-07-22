"use client";

import { apiRequest } from "../lib/apiClient";
import { AbandonedCartWithRelations } from "../types/abandonedCart";
import { emptyWithoutOrg } from "./orgQuery";

export interface AbandonedCartFilters {
  converted?: boolean;
  dateFrom?: string;
  dateTo?: string;
  formId?: string;
  funnelName?: string;
  productId?: string;
}

export interface CartLineInput {
  product_id: string;
  quantity: number;
}

/** Parse selected_products JSON from a cart row. */
export function parseCartSelectedProducts(
  cart: Pick<AbandonedCartWithRelations, "selected_products">
): CartLineInput[] {
  const raw = cart.selected_products;
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter(
      (row): row is { product_id: string; quantity?: number } =>
        !!row &&
        typeof row === "object" &&
        typeof (row as { product_id?: unknown }).product_id === "string"
    )
    .map((row) => ({
      product_id: row.product_id,
      quantity: Math.max(1, Number(row.quantity) || 1),
    }));
}

interface CartDto {
  id: string;
  organizationId: string;
  formId: string | null;
  customerName: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  deliveryAddress: string | null;
  state: string | null;
  location: string | null;
  selectedPackage: string | null;
  selectedItems: string | null;
  productName: string | null;
  mailQuan: number | null;
  agentQuan: number | null;
  quantity: number | null;
  product2: string | null;
  mailQuan2: number | null;
  agentQuan2: number | null;
  quantity2: number | null;
  salesPrice: string | null;
  costPrice: string | null;
  deliveryFee: string | null;
  profit: string | null;
  pageUrl: string | null;
  filledFieldsCount: number;
  filledFields: string[] | null;
  fieldValues: Record<string, unknown> | null;
  selectedProducts: unknown[] | null;
  abandonedAt: string;
  convertedToOrder: boolean;
  convertedOrderId: string | null;
  funnelName: string | null;
  offerName: string | null;
  subBrand: string | null;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function cartFromDto(dto: CartDto): AbandonedCartWithRelations {
  return {
    id: dto.id,
    organization_id: dto.organizationId,
    form_id: dto.formId,
    customer_name: dto.customerName,
    phone_number: dto.phoneNumber,
    whatsapp_number: dto.whatsappNumber,
    delivery_address: dto.deliveryAddress,
    state: dto.state,
    location: dto.location,
    selected_package: dto.selectedPackage,
    selected_items: dto.selectedItems,
    product_name: dto.productName,
    mail_quan: dto.mailQuan,
    agent_quan: dto.agentQuan,
    quantity: dto.quantity,
    product2: dto.product2,
    mail_quan2: dto.mailQuan2,
    agent_quan2: dto.agentQuan2,
    quantity2: dto.quantity2,
    sales_price: dto.salesPrice != null ? Number(dto.salesPrice) : null,
    cost_price: dto.costPrice != null ? Number(dto.costPrice) : null,
    delivery_fee: dto.deliveryFee != null ? Number(dto.deliveryFee) : null,
    profit: dto.profit != null ? Number(dto.profit) : null,
    page_url: dto.pageUrl,
    filled_fields_count: dto.filledFieldsCount,
    filled_fields: dto.filledFields,
    field_values: dto.fieldValues,
    selected_products: dto.selectedProducts,
    abandoned_at: dto.abandonedAt,
    converted_to_order: dto.convertedToOrder,
    converted_order_id: dto.convertedOrderId,
    funnel_name: dto.funnelName,
    offer_name: dto.offerName,
    sub_brand: dto.subBrand,
    note: dto.note,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function buildQuery(
  offset: number,
  limit: number,
  sortOrder: "asc" | "desc",
  searchQuery?: string,
  filters?: AbandonedCartFilters
): string {
  const params = new URLSearchParams();
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  params.set("sortOrder", sortOrder);
  if (searchQuery?.trim()) params.set("search", searchQuery.trim());
  if (filters?.converted !== undefined) params.set("converted", String(filters.converted));
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.formId) params.set("formId", filters.formId);
  if (filters?.funnelName) params.set("funnelName", filters.funnelName);
  if (filters?.productId) params.set("productId", filters.productId);
  return `?${params.toString()}`;
}

export async function fetchAbandonedCarts(
  organizationId: string | null,
  offset: number = 0,
  limit: number = 20,
  sortOrder: "asc" | "desc" = "desc",
  searchQuery?: string,
  filters?: AbandonedCartFilters
): Promise<AbandonedCartWithRelations[]> {
  const empty = emptyWithoutOrg<AbandonedCartWithRelations>(organizationId);
  if (empty) return empty;

  const { carts } = await apiRequest<{ carts: CartDto[] }>(
    `/org/numbatrak/abandoned-carts${buildQuery(offset, limit, sortOrder, searchQuery, filters)}`
  );
  return carts.map(cartFromDto);
}

export async function fetchAbandonedCartsCount(
  organizationId: string | null,
  searchQuery?: string,
  filters?: AbandonedCartFilters
): Promise<number> {
  if (!organizationId) return 0;

  const params = new URLSearchParams();
  if (searchQuery?.trim()) params.set("search", searchQuery.trim());
  if (filters?.converted !== undefined) params.set("converted", String(filters.converted));
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.formId) params.set("formId", filters.formId);
  if (filters?.funnelName) params.set("funnelName", filters.funnelName);
  if (filters?.productId) params.set("productId", filters.productId);

  const { count } = await apiRequest<{ count: number }>(`/org/numbatrak/abandoned-carts/count?${params.toString()}`);
  return count;
}

export async function fetchAbandonedCartFunnels(organizationId: string | null): Promise<string[]> {
  if (!organizationId) return [];
  const { funnels } = await apiRequest<{ funnels: string[] }>("/org/numbatrak/abandoned-carts/funnels");
  return funnels;
}

/**
 * @deprecated Pricing resolution now happens server-side inside the convert
 * endpoint (POST /abandoned-carts/:id/convert) - kept for signature
 * compatibility with any not-yet-repointed caller. Always returns [].
 */
export async function resolveCartLinePrices(
  _organizationId: string,
  _lines: CartLineInput[]
): Promise<Array<{ product_id: string; quantity: number; unit_price_at_submission: number; unit_cost_at_submission: number }>> {
  return [];
}

export async function createAbandonedCart(input: {
  customer_name?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  delivery_address?: string | null;
  state?: string | null;
  location?: string | null;
  selected_package?: string | null;
  selected_items?: string | null;
  product_name?: string | null;
  mail_quan?: number | null;
  agent_quan?: number | null;
  quantity?: number | null;
  product2?: string | null;
  mail_quan2?: number | null;
  agent_quan2?: number | null;
  quantity2?: number | null;
  sales_price?: number | null;
  page_url?: string | null;
  filled_fields_count?: number;
  note?: string | null;
  organization_id: string;
  form_id?: string | null;
  funnel_name?: string | null;
  offer_name?: string | null;
  sub_brand?: string | null;
  abandoned_at?: string;
}): Promise<AbandonedCartWithRelations> {
  const dto = await apiRequest<CartDto>("/org/numbatrak/abandoned-carts", {
    method: "POST",
    body: {
      customerName: input.customer_name,
      phoneNumber: input.phone_number,
      whatsappNumber: input.whatsapp_number,
      deliveryAddress: input.delivery_address,
      state: input.state,
      location: input.location,
      selectedPackage: input.selected_package,
      selectedItems: input.selected_items,
      productName: input.product_name,
      mailQuan: input.mail_quan,
      agentQuan: input.agent_quan,
      quantity: input.quantity,
      product2: input.product2,
      mailQuan2: input.mail_quan2,
      agentQuan2: input.agent_quan2,
      quantity2: input.quantity2,
      salesPrice: input.sales_price,
      pageUrl: input.page_url,
      filledFieldsCount: input.filled_fields_count,
      note: input.note,
      formId: input.form_id,
      funnelName: input.funnel_name,
      offerName: input.offer_name,
      subBrand: input.sub_brand,
      abandonedAt: input.abandoned_at,
    },
  });
  return cartFromDto(dto);
}

export async function updateAbandonedCart(
  id: string,
  input: Partial<{
    customer_name: string | null;
    phone_number: string | null;
    whatsapp_number: string | null;
    delivery_address: string | null;
    state: string | null;
    location: string | null;
    selected_package: string | null;
    selected_items: string | null;
    product_name: string | null;
    mail_quan: number | null;
    agent_quan: number | null;
    quantity: number | null;
    product2: string | null;
    mail_quan2: number | null;
    agent_quan2: number | null;
    quantity2: number | null;
    sales_price: number | null;
    page_url: string | null;
    filled_fields_count: number;
    converted_to_order: boolean;
    converted_order_id: string | null;
    funnel_name: string | null;
    offer_name: string | null;
    sub_brand: string | null;
    note: string | null;
  }>
): Promise<AbandonedCartWithRelations> {
  const dto = await apiRequest<CartDto>(`/org/numbatrak/abandoned-carts/${id}`, {
    method: "PATCH",
    body: {
      customerName: input.customer_name,
      phoneNumber: input.phone_number,
      whatsappNumber: input.whatsapp_number,
      deliveryAddress: input.delivery_address,
      state: input.state,
      location: input.location,
      selectedPackage: input.selected_package,
      selectedItems: input.selected_items,
      productName: input.product_name,
      mailQuan: input.mail_quan,
      agentQuan: input.agent_quan,
      quantity: input.quantity,
      product2: input.product2,
      mailQuan2: input.mail_quan2,
      agentQuan2: input.agent_quan2,
      quantity2: input.quantity2,
      salesPrice: input.sales_price,
      pageUrl: input.page_url,
      filledFieldsCount: input.filled_fields_count,
      convertedToOrder: input.converted_to_order,
      convertedOrderId: input.converted_order_id,
      funnelName: input.funnel_name,
      offerName: input.offer_name,
      subBrand: input.sub_brand,
      note: input.note,
    },
  });
  return cartFromDto(dto);
}

export async function removeAbandonedCart(id: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/abandoned-carts/${id}`, { method: "DELETE" });
}

/**
 * Note-overwrite behavior (destroys any prior note) is preserved from the
 * source app - not a bug to fix without a product decision.
 */
export async function markAsConverted(cartId: string, customerOrderId: string): Promise<AbandonedCartWithRelations> {
  return updateAbandonedCart(cartId, {
    converted_to_order: true,
    converted_order_id: customerOrderId,
    note: `Converted to customer order ${customerOrderId}`,
  });
}
