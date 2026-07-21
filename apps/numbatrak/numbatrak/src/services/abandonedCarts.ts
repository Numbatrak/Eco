"use client";

import { supabase } from "../supabaseClient";
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

function applyAbandonedCartFilters<T extends ReturnType<typeof supabase.from>>(
  query: T,
  filters?: AbandonedCartFilters
) {
  if (filters?.converted !== undefined) {
    query = query.eq("converted_to_order", filters.converted) as T;
  }
  if (filters?.dateFrom) {
    query = query.gte("abandoned_at", filters.dateFrom) as T;
  }
  if (filters?.dateTo) {
    query = query.lte("abandoned_at", filters.dateTo) as T;
  }
  if (filters?.formId) {
    query = query.eq("form_id", filters.formId) as T;
  }
  if (filters?.funnelName) {
    query = query.eq("funnel_name", filters.funnelName) as T;
  }
  if (filters?.productId) {
    query = query.contains("selected_products", [{ product_id: filters.productId }]) as T;
  }
  return query;
}

/**
 * Fetch all abandoned carts with pagination (filtered by organization)
 */
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

  let query = supabase
    .from("abandoned_carts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("abandoned_at", { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `customer_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`
    );
  }

  query = applyAbandonedCartFilters(query, filters);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []) as AbandonedCartWithRelations[];
}

/**
 * Get total count of abandoned carts (filtered by organization)
 */
export async function fetchAbandonedCartsCount(
  organizationId: string | null,
  searchQuery?: string,
  filters?: AbandonedCartFilters
): Promise<number> {
  if (!organizationId) return 0;

  let query = supabase
    .from("abandoned_carts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `customer_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`
    );
  }

  query = applyAbandonedCartFilters(query, filters);

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count || 0;
}

/**
 * Distinct funnel names on abandoned carts for filter dropdowns.
 */
export async function fetchAbandonedCartFunnels(
  organizationId: string | null
): Promise<string[]> {
  if (!organizationId) return [];

  const { data, error } = await supabase
    .from("abandoned_carts")
    .select("funnel_name")
    .eq("organization_id", organizationId)
    .not("funnel_name", "is", null);

  if (error) throw error;

  const names = new Set<string>();
  for (const row of data ?? []) {
    const name = (row as { funnel_name?: string }).funnel_name?.trim();
    if (name) names.add(name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** Resolve catalog prices for cart line items at convert time. */
export async function resolveCartLinePrices(
  organizationId: string,
  lines: CartLineInput[]
): Promise<
  Array<{
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }>
> {
  if (lines.length === 0) return [];

  const productIds = [...new Set(lines.map((l) => l.product_id))];
  const { data, error } = await supabase
    .from("products")
    .select("id, base_price, cost_price")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  if (error) throw error;

  const priceById = new Map(
    (data ?? []).map((row: { id: string; base_price: number; cost_price: number }) => [
      row.id,
      {
        price: Number(row.base_price) || 0,
        cost: Number(row.cost_price) || 0,
      },
    ])
  );

  return lines
    .map((line) => {
      const prices = priceById.get(line.product_id);
      if (!prices) return null;
      return {
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price_at_submission: prices.price,
        unit_cost_at_submission: prices.cost,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

/**
 * Create a new abandoned cart
 */
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
  const now = new Date();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const { data, error } = await supabase
    .from("abandoned_carts")
    .insert([
      {
        ...input,
        order_date: now.toISOString().split("T")[0],
        order_month: monthNames[now.getMonth()],
        order_year: now.getFullYear().toString(),
        order_status: "Pending",
        cost_price: null,
        delivery_fee: null,
        profit: null,
        delivery_date: null,
        delivery_month: null,
        delivery_year: null,
        confirmed_delivery: false,
        agent_name: null,
        subject: "Abandoned Cart",
        abandoned_at: input.abandoned_at ?? now.toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AbandonedCartWithRelations;
}

/**
 * Update an abandoned cart
 */
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
  const { data, error } = await supabase
    .from("abandoned_carts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as AbandonedCartWithRelations;
}

/**
 * Delete an abandoned cart
 */
export async function removeAbandonedCart(id: string): Promise<void> {
  const { error } = await supabase
    .from("abandoned_carts")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Mark an abandoned cart as converted to a customer order
 */
export async function markAsConverted(
  cartId: string,
  customerOrderId: string
): Promise<AbandonedCartWithRelations> {
  return updateAbandonedCart(cartId, {
    converted_to_order: true,
    converted_order_id: customerOrderId,
    note: `Converted to customer order ${customerOrderId}`,
  });
}
