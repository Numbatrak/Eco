"use client";

import { supabase } from "../supabaseClient";
import {
  FormResponse,
  FormResponseItem,
  FormResponseWithItems,
  FormResponseFilters,
} from "../types/formResponse";
import {
  calculateProfitFromItems,
  calculatePotentialProfit,
} from "../utils/formResponseHelpers";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Fetch all form responses with their items (filtered by organization)
 */
export async function fetchFormResponses(
  organizationId: string | null,
  filters?: FormResponseFilters
): Promise<FormResponseWithItems[]> {
  const empty = emptyWithoutOrg<FormResponseWithItems>(organizationId);
  if (empty) return empty;

  let query = supabase.from("form_responses").select("*").eq("organization_id", organizationId);

  // Apply filters
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.response_type) {
    query = query.eq("response_type", filters.response_type);
  }

  if (filters?.form_id) {
    query = query.eq("form_id", filters.form_id);
  }

  if (filters?.csr_id) {
    query = query.eq("csr_id", filters.csr_id);
  }

  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from);
  }

  if (filters?.date_to) {
    const dateToPlusOne = new Date(filters.date_to);
    dateToPlusOne.setDate(dateToPlusOne.getDate() + 1);
    query = query.lt("created_at", dateToPlusOne.toISOString());
  }

  // Text search (if provided) - search in multiple fields
  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    // Use OR condition to search across multiple fields
    query = query.or(
      `customer_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,package_name.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`
    );
  }

  const { data: responses, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    throw error;
  }

  if (!responses || responses.length === 0) {
    return [];
  }

  // Get all form_response_ids
  const responseIds = responses.map((r: any) => r.id);

  // Fetch items separately (avoid relationship errors)
  const { data: items, error: itemsError } = await supabase
    .from("form_response_items")
    .select("*")
    .in("form_response_id", responseIds);

  if (itemsError) {
    console.error("Error fetching form response items:", itemsError);
    // Continue without items rather than failing completely
  }

  // Group items by form_response_id
  const itemsMap = new Map<string, FormResponseItem[]>();
  if (items) {
    items.forEach((item: any) => {
      const responseId = item.form_response_id;
      if (!itemsMap.has(responseId)) {
        itemsMap.set(responseId, []);
      }
      itemsMap.get(responseId)!.push({
        id: item.id,
        form_response_id: item.form_response_id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price_at_submission: Number(item.unit_price_at_submission),
        unit_cost_at_submission: Number(item.unit_cost_at_submission),
        total_price: Number(item.total_price),
        total_cost: Number(item.total_cost),
        profit: Number(item.profit),
        created_at: item.created_at ?? null,
      });
    });
  }

  // Map responses to include items
  return responses.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    form_id: row.form_id,
    response_type: row.response_type,
    status: row.status,
    source: row.source || "wordpress",
    page_url: row.page_url,
    field_values: row.field_values || {},
    selected_products: row.selected_products || [],
    phone_number: row.phone_number,
    package_name: row.package_name,
    customer_name: row.customer_name,
    profit: row.profit != null ? Number(row.profit) : 0,
    order_revenue: row.order_revenue != null ? Number(row.order_revenue) : 0,
    order_cost: row.order_cost != null ? Number(row.order_cost) : 0,
    amount_paid: row.amount_paid != null ? Number(row.amount_paid) : null,
    delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
    notes: row.notes || null,
    agent_id: row.agent_id != null ? Number(row.agent_id) : null,
    csr_id: row.csr_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    completed_at: row.completed_at ?? null,
    converted_from_abandoned: row.converted_from_abandoned ?? false,
    converted_response_id: row.converted_response_id,
    items: itemsMap.get(row.id) || [],
  }));
}

/**
 * Fetch a single form response by ID with items and form schema
 */
export async function fetchFormResponseById(
  id: string
): Promise<FormResponseWithItems | null> {
  // Fetch form response
  const { data: response, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  if (!response) {
    return null;
  }

  // Fetch items
  const { data: items, error: itemsError } = await supabase
    .from("form_response_items")
    .select("*")
    .eq("form_response_id", id);

  if (itemsError) {
    console.error("Error fetching form response items:", itemsError);
  }

  // Fetch form schema if form_id exists
  let form = null;
  if (response.form_id) {
    const { data: formData, error: formError } = await supabase
      .from("forms")
      .select("id, name, schema")
      .eq("id", response.form_id)
      .single();

    if (!formError && formData) {
      form = {
        id: formData.id,
        name: formData.name,
        schema: formData.schema,
      };
    }
  }

  return {
    id: response.id,
    organization_id: response.organization_id,
    form_id: response.form_id,
    response_type: response.response_type,
    status: response.status,
    source: response.source || "wordpress",
    page_url: response.page_url,
    field_values: response.field_values || {},
    selected_products: response.selected_products || [],
    phone_number: response.phone_number,
    package_name: response.package_name,
    customer_name: response.customer_name,
    profit: response.profit ? Number(response.profit) : 0,
    order_revenue:
      response.order_revenue != null ? Number(response.order_revenue) : 0,
    order_cost: response.order_cost != null ? Number(response.order_cost) : 0,
    amount_paid:
      response.amount_paid != null ? Number(response.amount_paid) : null,
    delivery_fee:
      response.delivery_fee != null ? Number(response.delivery_fee) : null,
    notes: response.notes || null,
    agent_id: response.agent_id != null ? Number(response.agent_id) : null,
    created_at: response.created_at ?? null,
    updated_at: response.updated_at ?? null,
    completed_at: response.completed_at ?? null,
    converted_from_abandoned: response.converted_from_abandoned ?? false,
    converted_response_id: response.converted_response_id,
    items: (items || []).map((item: any) => ({
      id: item.id,
      form_response_id: item.form_response_id,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price_at_submission: Number(item.unit_price_at_submission),
      unit_cost_at_submission: Number(item.unit_cost_at_submission),
      total_price: Number(item.total_price),
      total_cost: Number(item.total_cost),
      profit: Number(item.profit),
      created_at: item.created_at ?? null,
    })),
    form,
  };
}

/**
 * Update a form response
 * When status is changed to 'completed', profit will be calculated by the database trigger
 */
export async function updateFormResponse(
  id: string,
  updates: Partial<{
    status: "abandoned" | "pending" | "completed" | "cancelled";
    notes: string | null;
    delivery_fee: number | null;
    amount_paid: number | null;
    agent_id: number | null;
  }>
): Promise<FormResponse> {
  const updateData: any = {};

  if (updates.status !== undefined) {
    updateData.status = updates.status;

    // If status is being set to 'completed', ensure completed_at is set
    // The trigger should handle this, but we'll set it explicitly to be safe
    if (updates.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
  }

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  if (updates.delivery_fee !== undefined) {
    updateData.delivery_fee = updates.delivery_fee;
  }

  if (updates.amount_paid !== undefined) {
    updateData.amount_paid = updates.amount_paid;
  }

  if (updates.agent_id !== undefined) {
    updateData.agent_id = updates.agent_id;
  }

  const { data, error } = await supabase
    .from("form_responses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return mapFormResponseFromRow(data);
}

/**
 * Delete a form response (cascade will delete items)
 */
export async function deleteFormResponse(id: string): Promise<void> {
  const { error } = await supabase.from("form_responses").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Calculate potential profit from items (regardless of status)
 * This shows what the profit would be if the order is completed
 */
export function calculatePotentialProfit(items: FormResponseItem[]): number {
  return calculateProfitFromItems(items);
}

/**
 * Helper function to map database row to FormResponse type
 */
function mapFormResponseFromRow(row: any): FormResponse {
  return {
    id: row.id,
    organization_id: row.organization_id,
    form_id: row.form_id,
    response_type: row.response_type,
    status: row.status,
    source: row.source || "wordpress",
    page_url: row.page_url,
    field_values: row.field_values || {},
    selected_products: row.selected_products || [],
    phone_number: row.phone_number,
    package_name: row.package_name,
    customer_name: row.customer_name,
    profit: row.profit != null ? Number(row.profit) : 0,
    order_revenue: row.order_revenue != null ? Number(row.order_revenue) : 0,
    order_cost: row.order_cost != null ? Number(row.order_cost) : 0,
    amount_paid: row.amount_paid != null ? Number(row.amount_paid) : null,
    delivery_fee: row.delivery_fee != null ? Number(row.delivery_fee) : null,
    notes: row.notes || null,
    agent_id: row.agent_id != null ? Number(row.agent_id) : null,
    csr_id: row.csr_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    completed_at: row.completed_at ?? null,
    converted_from_abandoned: row.converted_from_abandoned ?? false,
    converted_response_id: row.converted_response_id,
  };
}
