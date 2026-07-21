"use client";

import { supabase } from "../supabaseClient";
import { FormProduct } from "../types/form";

/**
 * Fetch form products for a specific form
 */
export async function fetchFormProducts(formId: string): Promise<FormProduct[]> {
  const { data, error } = await supabase
    .from("form_products")
    .select("*")
    .eq("form_id", formId)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    form_id: row.form_id,
    product_id: String(row.product_id), // Convert to string for consistency
    min_quantity: Number(row.min_quantity),
    max_quantity: row.max_quantity ? Number(row.max_quantity) : null,
    required: row.required ?? false,
    pricing_mode: row.pricing_mode ?? 'fixed',
    display_order: Number(row.display_order),
  }));
}

/**
 * Add a product to a form
 */
export async function addProductToForm(input: {
  form_id: string;
  product_id: string;
  min_quantity?: number;
  max_quantity?: number | null;
  required?: boolean;
  pricing_mode?: 'fixed' | 'selectable';
  display_order?: number;
}): Promise<FormProduct> {
  const { data, error } = await supabase
    .from("form_products")
    .insert([{
      form_id: input.form_id,
      product_id: Number(input.product_id), // Convert back to number for DB
      min_quantity: input.min_quantity ?? 1,
      max_quantity: input.max_quantity ?? null,
      required: input.required ?? false,
      pricing_mode: input.pricing_mode ?? 'fixed',
      display_order: input.display_order ?? 0,
    }])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from insert");
  }

  return {
    id: data.id,
    form_id: data.form_id,
    product_id: String(data.product_id),
    min_quantity: Number(data.min_quantity),
    max_quantity: data.max_quantity ? Number(data.max_quantity) : null,
    required: data.required ?? false,
    pricing_mode: data.pricing_mode ?? 'fixed',
    display_order: Number(data.display_order),
  };
}

/**
 * Update a form product
 */
export async function updateFormProduct(
  formProductId: string,
  input: {
    min_quantity?: number;
    max_quantity?: number | null;
    required?: boolean;
    pricing_mode?: 'fixed' | 'selectable';
    display_order?: number;
  }
): Promise<FormProduct> {
  const updateData: any = {};
  if (input.min_quantity !== undefined) updateData.min_quantity = input.min_quantity;
  if (input.max_quantity !== undefined) updateData.max_quantity = input.max_quantity;
  if (input.required !== undefined) updateData.required = input.required;
  if (input.pricing_mode !== undefined) updateData.pricing_mode = input.pricing_mode;
  if (input.display_order !== undefined) updateData.display_order = input.display_order;

  const { data, error } = await supabase
    .from("form_products")
    .update(updateData)
    .eq("id", formProductId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return {
    id: data.id,
    form_id: data.form_id,
    product_id: String(data.product_id),
    min_quantity: Number(data.min_quantity),
    max_quantity: data.max_quantity ? Number(data.max_quantity) : null,
    required: data.required ?? false,
    pricing_mode: data.pricing_mode ?? 'fixed',
    display_order: Number(data.display_order),
  };
}

/**
 * Remove a product from a form
 */
export async function removeProductFromForm(formProductId: string): Promise<void> {
  const { error } = await supabase
    .from("form_products")
    .delete()
    .eq("id", formProductId);
  
  if (error) {
    throw error;
  }
}
