"use client";

import { supabase } from "../supabaseClient";
import {
  GeneralExpense,
  GeneralExpenseWithRelations,
} from "../types/generalExpense";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Read all general expenses from the database with relations
 */
export async function fetchGeneralExpenses(
  organizationId: string | null = null
): Promise<GeneralExpenseWithRelations[]> {
  const empty = emptyWithoutOrg<GeneralExpenseWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase.from("general_expenses").select("*").eq("organization_id", organizationId);

  const { data: expenses, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!expenses || expenses.length === 0) {
    return [];
  }

  // Get unique product IDs
  const productIds = [...new Set(expenses.map((e: any) => e.product_id).filter(Boolean))];

  // Fetch products separately
  const productsResult = productIds.length > 0
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [], error: null };

  // Create map for quick lookup
  const productsMap = new Map(
    (productsResult.data || []).map((p: any) => [
      Number(p.id),
      { id: Number(p.id), name: p.name }
    ])
  );

  return expenses.map((row: any) => ({
    id: Number(row.id),
    date: row.date,
    product_id: row.product_id ? Number(row.product_id) : null,
    category: row.category,
    subcategory: row.subcategory,
    amount: Number(row.amount),
    created_at: row.created_at ?? null,
    product: row.product_id ? productsMap.get(Number(row.product_id)) || null : null,
  }));
}

/**
 * Insert a new general expense into the database
 */
export async function createGeneralExpense(input: {
  date: string;
  product_id?: number | null;
  category: string;
  subcategory: string;
  amount: number;
  organization_id: string;
}): Promise<GeneralExpense> {
  const { data, error } = await supabase
    .from("general_expenses")
    .insert([
      {
        date: input.date,
        product_id: input.product_id || null,
        category: input.category,
        subcategory: input.subcategory,
        amount: input.amount,
        organization_id: input.organization_id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from insert");
  }

  return {
    id: Number(data.id),
    date: data.date,
    product_id: data.product_id ? Number(data.product_id) : null,
    category: data.category,
    subcategory: data.subcategory,
    amount: Number(data.amount),
    created_at: data.created_at ?? null,
  };
}

/**
 * Update an existing general expense in the database
 */
export async function updateGeneralExpense(
  expenseId: number,
  input: {
    date?: string;
    product_id?: number | null;
    category?: string;
    subcategory?: string;
    amount?: number;
  }
): Promise<GeneralExpense> {
  const updateData: any = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.product_id !== undefined) updateData.product_id = input.product_id;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.subcategory !== undefined)
    updateData.subcategory = input.subcategory;
  if (input.amount !== undefined) updateData.amount = input.amount;

  const { data, error } = await supabase
    .from("general_expenses")
    .update(updateData)
    .eq("id", expenseId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return {
    id: Number(data.id),
    date: data.date,
    product_id: data.product_id ? Number(data.product_id) : null,
    category: data.category,
    subcategory: data.subcategory,
    amount: Number(data.amount),
    created_at: data.created_at ?? null,
  };
}

/**
 * Delete a general expense from the database
 */
export async function removeGeneralExpense(expenseId: number): Promise<void> {
  const { error } = await supabase
    .from("general_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) {
    throw error;
  }
}

/**
 * Get day of week name from date
 */
export function getDayOfWeek(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("default", { weekday: "long" });
}

/**
 * Get month name from date
 */
export function getMonthName(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("default", { month: "long" });
}
