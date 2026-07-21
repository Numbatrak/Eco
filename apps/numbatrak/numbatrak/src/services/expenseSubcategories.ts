"use client";

import { OrgExpenseCategory } from "../constants/expenseCategories";
import { supabase } from "../supabaseClient";
import { emptyWithoutOrg } from "./orgQuery";

export interface ExpenseSubcategoryRow {
  id: string;
  organization_id: string;
  parent_category: OrgExpenseCategory;
  slug: string;
  label: string;
  created_at?: string | null;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export async function fetchCustomExpenseSubcategories(
  organizationId: string | null
): Promise<ExpenseSubcategoryRow[]> {
  const empty = emptyWithoutOrg<ExpenseSubcategoryRow>(organizationId);
  if (empty) return empty;

  const { data, error } = await supabase
    .from("expense_subcategories")
    .select("*")
    .eq("organization_id", organizationId)
    .order("label", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    parent_category: row.parent_category as OrgExpenseCategory,
    slug: row.slug,
    label: row.label,
    created_at: row.created_at ?? null,
  }));
}

export async function createCustomExpenseSubcategory(input: {
  organization_id: string;
  parent_category: OrgExpenseCategory;
  label: string;
}): Promise<ExpenseSubcategoryRow> {
  const label = input.label.trim();
  if (!label) throw new Error("Subcategory label is required");

  const slug = slugify(label);
  const { data, error } = await supabase
    .from("expense_subcategories")
    .insert([
      {
        organization_id: input.organization_id,
        parent_category: input.parent_category,
        slug,
        label,
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from insert");

  return {
    id: data.id,
    organization_id: data.organization_id,
    parent_category: data.parent_category as OrgExpenseCategory,
    slug: data.slug,
    label: data.label,
    created_at: data.created_at ?? null,
  };
}

export async function deleteCustomExpenseSubcategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("expense_subcategories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
