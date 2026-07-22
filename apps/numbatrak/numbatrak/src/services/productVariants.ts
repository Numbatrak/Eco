"use client";

import { apiRequest } from "../lib/apiClient";
import { ProductVariant } from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";
import { fetchProductsWithDetails } from "./products";

/**
 * Variants are already embedded on each product row returned by
 * fetchProductsWithDetails (GET /org/numbatrak/products/details) - these
 * "by product(s)" reads just filter that same response rather than hitting
 * a separate endpoint, since the backend has no standalone variant-list route.
 */
export async function fetchVariantsByProduct(
  organizationId: string | null,
  productId: string
): Promise<ProductVariant[]> {
  const empty = emptyWithoutOrg<ProductVariant>(organizationId);
  if (empty) return empty;

  const products = await fetchProductsWithDetails(organizationId);
  return products.find((p) => p.id === productId)?.variants ?? [];
}

export async function fetchVariantsForProducts(
  organizationId: string | null,
  productIds: string[]
): Promise<Record<string, ProductVariant[]>> {
  const result: Record<string, ProductVariant[]> = {};
  if (!organizationId || productIds.length === 0) return result;

  const products = await fetchProductsWithDetails(organizationId);
  for (const p of products) {
    if (!productIds.includes(p.id)) continue;
    result[p.id] = p.variants ?? [];
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
  const dto = await apiRequest<{
    id: string;
    organizationId: string;
    productId: string;
    name: string;
    sku: string | null;
    basePrice: string;
    costPrice: string;
    active: boolean;
    displayOrder: number;
    createdAt: string | null;
    updatedAt: string | null;
  }>(`/org/numbatrak/products/${input.product_id}/variants`, {
    method: "POST",
    body: {
      name: input.name.trim(),
      sku: input.sku ?? null,
      basePrice: input.base_price,
      costPrice: input.cost_price,
      displayOrder: input.display_order ?? 0,
    },
  });

  return {
    id: dto.id,
    organization_id: dto.organizationId,
    product_id: dto.productId,
    name: dto.name,
    sku: dto.sku,
    base_price: Number(dto.basePrice),
    cost_price: Number(dto.costPrice),
    active: dto.active,
    display_order: dto.displayOrder,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function updateProductVariant(
  variantId: string,
  input: Partial<Pick<ProductVariant, "name" | "sku" | "base_price" | "cost_price" | "active" | "display_order">>
): Promise<ProductVariant> {
  const dto = await apiRequest<{
    id: string;
    organizationId: string;
    productId: string;
    name: string;
    sku: string | null;
    basePrice: string;
    costPrice: string;
    active: boolean;
    displayOrder: number;
    createdAt: string | null;
    updatedAt: string | null;
  }>(`/org/numbatrak/product-variants/${variantId}`, {
    method: "PATCH",
    body: {
      name: input.name,
      sku: input.sku,
      basePrice: input.base_price,
      costPrice: input.cost_price,
      active: input.active,
      displayOrder: input.display_order,
    },
  });

  return {
    id: dto.id,
    organization_id: dto.organizationId,
    product_id: dto.productId,
    name: dto.name,
    sku: dto.sku,
    base_price: Number(dto.basePrice),
    cost_price: Number(dto.costPrice),
    active: dto.active,
    display_order: dto.displayOrder,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function removeProductVariant(variantId: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/product-variants/${variantId}`, { method: "DELETE" });
}
