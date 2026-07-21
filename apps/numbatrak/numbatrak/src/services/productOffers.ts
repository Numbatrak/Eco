"use client";

import { supabase } from "../supabaseClient";
import {
  ProductOffer,
  ProductOfferBundleItem,
  ProductOfferType,
} from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";

function mapOfferRow(row: Record<string, unknown>): ProductOffer {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    product_id: row.product_id as string,
    variant_id: (row.variant_id as string | null) ?? null,
    offer_type: (row.offer_type as ProductOfferType) ?? "single",
    label: (row.label as string) ?? "Offer",
    min_quantity: Number(row.min_quantity ?? 1),
    free_quantity: Number(row.free_quantity ?? 0),
    bundle_items: (row.bundle_items as ProductOfferBundleItem[] | null) ?? null,
    price: Number(row.price ?? 0),
    unit_cost: Number(row.unit_cost ?? 0),
    active: row.active !== false,
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    display_order: Number(row.display_order ?? 0),
    created_at: (row.created_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
  };
}

export async function fetchOffersByProduct(
  organizationId: string | null,
  productId: string
): Promise<ProductOffer[]> {
  const empty = emptyWithoutOrg<ProductOffer>(organizationId);
  if (empty) return empty;

  const { data, error } = await supabase
    .from("product_offers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapOfferRow);
}

export async function fetchOffersForProducts(
  organizationId: string | null,
  productIds: string[]
): Promise<Record<string, ProductOffer[]>> {
  const result: Record<string, ProductOffer[]> = {};
  if (!organizationId || productIds.length === 0) return result;

  const { data, error } = await supabase
    .from("product_offers")
    .select("*")
    .eq("organization_id", organizationId)
    .in("product_id", productIds)
    .order("display_order", { ascending: true });

  if (error) throw error;
  for (const row of data ?? []) {
    const o = mapOfferRow(row);
    if (!result[o.product_id]) result[o.product_id] = [];
    result[o.product_id].push(o);
  }
  return result;
}

export async function createProductOffer(input: {
  organization_id: string;
  product_id: string;
  variant_id?: string | null;
  offer_type: ProductOfferType;
  label: string;
  min_quantity?: number;
  free_quantity?: number;
  bundle_items?: ProductOfferBundleItem[] | null;
  price: number;
  unit_cost: number;
  starts_at?: string | null;
  ends_at?: string | null;
  display_order?: number;
}): Promise<ProductOffer> {
  const { data, error } = await supabase
    .from("product_offers")
    .insert([
      {
        organization_id: input.organization_id,
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        offer_type: input.offer_type,
        label: input.label.trim(),
        min_quantity: input.min_quantity ?? 1,
        free_quantity: input.free_quantity ?? 0,
        bundle_items: input.bundle_items ?? null,
        price: input.price,
        unit_cost: input.unit_cost,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        display_order: input.display_order ?? 0,
        active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from insert");
  return mapOfferRow(data);
}

export async function updateProductOffer(
  offerId: string,
  input: Partial<
    Pick<
      ProductOffer,
      | "variant_id"
      | "offer_type"
      | "label"
      | "min_quantity"
      | "free_quantity"
      | "bundle_items"
      | "price"
      | "unit_cost"
      | "active"
      | "starts_at"
      | "ends_at"
      | "display_order"
    >
  >
): Promise<ProductOffer> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.variant_id !== undefined) updateData.variant_id = input.variant_id;
  if (input.offer_type !== undefined) updateData.offer_type = input.offer_type;
  if (input.label !== undefined) updateData.label = input.label;
  if (input.min_quantity !== undefined)
    updateData.min_quantity = input.min_quantity;
  if (input.free_quantity !== undefined)
    updateData.free_quantity = input.free_quantity;
  if (input.bundle_items !== undefined)
    updateData.bundle_items = input.bundle_items;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.unit_cost !== undefined) updateData.unit_cost = input.unit_cost;
  if (input.active !== undefined) updateData.active = input.active;
  if (input.starts_at !== undefined) updateData.starts_at = input.starts_at;
  if (input.ends_at !== undefined) updateData.ends_at = input.ends_at;
  if (input.display_order !== undefined)
    updateData.display_order = input.display_order;

  const { data, error } = await supabase
    .from("product_offers")
    .update(updateData)
    .eq("id", offerId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from update");
  return mapOfferRow(data);
}

export async function removeProductOffer(offerId: string): Promise<void> {
  const { error } = await supabase
    .from("product_offers")
    .delete()
    .eq("id", offerId);
  if (error) throw error;
}

export async function setProductOfferActive(
  offerId: string,
  active: boolean
): Promise<ProductOffer> {
  return updateProductOffer(offerId, { active });
}
