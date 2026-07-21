"use client";

import { supabase } from "../supabaseClient";
import { Form, FormSchema } from "../types/form";
import { emptyWithoutOrg } from "./orgQuery";

function mapFormRow(row: Record<string, unknown>): Form {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: (row.name as string) ?? "Untitled Form",
    form_token: (row.form_token as string) ?? "",
    schema: (row.schema ?? { fields: [], submitButton: { text: "Submit Order" } }) as FormSchema,
    active: (row.active as boolean) ?? true,
    sub_brand: (row.sub_brand as string | null) ?? null,
    funnel_name: (row.funnel_name as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

/**
 * Read all forms from the database (filtered by organization)
 */
export async function fetchForms(organizationId: string | null): Promise<Form[]> {
  const empty = emptyWithoutOrg<Form>(organizationId);
  if (empty) return empty;

  let query = supabase
    .from("forms")
    .select("*")
    .eq("organization_id", organizationId);
  
  const { data, error } = await query
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => mapFormRow(row));
}

/**
 * Fetch a single form by ID
 */
export async function fetchFormById(formId: string): Promise<Form | null> {
  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", formId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapFormRow(data);
}

/**
 * Create a new form
 */
export async function createForm(input: {
  name: string;
  organization_id: string;
  form_token: string;
  schema: FormSchema;
  active?: boolean;
  sub_brand?: string | null;
  funnel_name?: string | null;
}): Promise<Form> {
  const { data, error } = await supabase
    .from("forms")
    .insert([{
      name: input.name,
      organization_id: input.organization_id,
      form_token: input.form_token,
      schema: input.schema,
      active: input.active ?? true,
      sub_brand: input.sub_brand ?? null,
      funnel_name: input.funnel_name ?? null,
    }])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from insert");
  }

  return mapFormRow(data);
}

/**
 * Update an existing form
 */
export async function updateForm(
  formId: string,
  input: {
    name?: string;
    form_token?: string;
    schema?: FormSchema;
    active?: boolean;
    sub_brand?: string | null;
    funnel_name?: string | null;
  }
): Promise<Form> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.form_token !== undefined) updateData.form_token = input.form_token;
  if (input.schema !== undefined) updateData.schema = input.schema;
  if (input.active !== undefined) updateData.active = input.active;
  if (input.sub_brand !== undefined) updateData.sub_brand = input.sub_brand;
  if (input.funnel_name !== undefined) updateData.funnel_name = input.funnel_name;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("forms")
    .update(updateData)
    .eq("id", formId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return mapFormRow(data);
}

/**
 * Delete a form from the database
 */
export async function removeForm(formId: string): Promise<void> {
  const { error } = await supabase
    .from("forms")
    .delete()
    .eq("id", formId);
  
  if (error) {
    throw error;
  }
}

/**
 * Generate a unique form token
 */
export function generateFormToken(): string {
  const prefix = "form_live_";
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `${prefix}${randomPart}`;
}
