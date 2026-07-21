"use client";

import { supabase } from "../supabaseClient";
import { ProductVariant } from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";

function mapVariantRow(row: Record<string, unknown>): ProductVariant {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    product_id: row.product_id as string,
    name: (row.name as string) ?? "Variant",
    sku: (row.sku as string | null) ?? null,
    base_price: Number(row.base_price ?? 0),
    cost_price: Number(row.cost_price ?? 0),
    active: row.active !== false,
    display_order: Number(row.display_order ?? 0),
    created_at: (row.created_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
  };
}

export async function fetchVariantsByProduct(
  organizationId: string | null,
  productId: string
): Promise<ProductVariant[]> {
  const empty = emptyWithoutOrg<ProductVariant>(organizationId);
  if (empty) return empty;

  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapVariantRow);
}

export async function fetchVariantsForProducts(
  organizationId: string | null,
  productIds: string[]
): Promise<Record<string, ProductVariant[]>> {
  const result: Record<string, ProductVariant[]> = {};
  if (!organizationId || productIds.length === 0) return result;

  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("organization_id", organizationId)
    .in("product_id", productIds)
    .order("display_order", { ascending: true });

  if (error) throw error;
  for (const row of data ?? []) {
    const v = mapVariantRow(row);
    if (!result[v.product_id]) result[v.product_id] = [];
    result[v.product_id].push(v);
  }
  return result;
}

export async function createProductVariant(input: {
  organization_id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  base_price: number;
  cost_price: number;
  display_order?: number;
}): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from("product_variants")
    .insert([
      {
        organization_id: input.organization_id,
        product_id: input.product_id,
        name: input.name.trim(),
        sku: input.sku ?? null,
        base_price: input.base_price,
        cost_price: input.cost_price,
        display_order: input.display_order ?? 0,
        active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from insert");
  return mapVariantRow(data);
}

export async function updateProductVariant(
  variantId: string,
  input: Partial<
    Pick<
      ProductVariant,
      "name" | "sku" | "base_price" | "cost_price" | "active" | "display_order"
    >
  >
): Promise<ProductVariant> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.sku !== undefined) updateData.sku = input.sku;
  if (input.base_price !== undefined) updateData.base_price = input.base_price;
  if (input.cost_price !== undefined) updateData.cost_price = input.cost_price;
  if (input.active !== undefined) updateData.active = input.active;
  if (input.display_order !== undefined)
    updateData.display_order = input.display_order;

  const { data, error } = await supabase
    .from("product_variants")
    .update(updateData)
    .eq("id", variantId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from update");
  return mapVariantRow(data);
}

export async function removeProductVariant(variantId: string): Promise<void> {
  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId);
  if (error) throw error;
}
