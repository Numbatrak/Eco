"use client";

import { apiRequest } from "../lib/apiClient";
import { ProductOffer, ProductOfferBundleItem, ProductOfferType } from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";
import { fetchProductsWithDetails } from "./products";

interface OfferDto {
  id: string;
  organizationId: string;
  productId: string;
  variantId: string | null;
  offerType: ProductOfferType;
  label: string;
  minQuantity: number;
  freeQuantity: number;
  bundleItems: ProductOfferBundleItem[] | null;
  price: string;
  unitCost: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  displayOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

function offerFromDto(dto: OfferDto): ProductOffer {
  return {
    id: dto.id,
    organization_id: dto.organizationId,
    product_id: dto.productId,
    variant_id: dto.variantId,
    offer_type: dto.offerType,
    label: dto.label,
    min_quantity: dto.minQuantity,
    free_quantity: dto.freeQuantity,
    bundle_items: dto.bundleItems,
    price: Number(dto.price),
    unit_cost: Number(dto.unitCost),
    active: dto.active,
    starts_at: dto.startsAt,
    ends_at: dto.endsAt,
    display_order: dto.displayOrder,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

/**
 * Offers are already embedded on each product row returned by
 * fetchProductsWithDetails - same reasoning as productVariants.ts's
 * "by product(s)" reads.
 */
export async function fetchOffersByProduct(
  organizationId: string | null,
  productId: string
): Promise<ProductOffer[]> {
  const empty = emptyWithoutOrg<ProductOffer>(organizationId);
  if (empty) return empty;

  const products = await fetchProductsWithDetails(organizationId);
  return products.find((p) => p.id === productId)?.offers ?? [];
}

export async function fetchOffersForProducts(
  organizationId: string | null,
  productIds: string[]
): Promise<Record<string, ProductOffer[]>> {
  const result: Record<string, ProductOffer[]> = {};
  if (!organizationId || productIds.length === 0) return result;

  const products = await fetchProductsWithDetails(organizationId);
  for (const p of products) {
    if (!productIds.includes(p.id)) continue;
    result[p.id] = p.offers ?? [];
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
  const dto = await apiRequest<OfferDto>(`/org/numbatrak/products/${input.product_id}/offers`, {
    method: "POST",
    body: {
      variantId: input.variant_id ?? null,
      offerType: input.offer_type,
      label: input.label.trim(),
      minQuantity: input.min_quantity ?? 1,
      freeQuantity: input.free_quantity ?? 0,
      bundleItems: input.bundle_items ?? null,
      price: input.price,
      unitCost: input.unit_cost,
      startsAt: input.starts_at ?? null,
      endsAt: input.ends_at ?? null,
      displayOrder: input.display_order ?? 0,
    },
  });
  return offerFromDto(dto);
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
  const dto = await apiRequest<OfferDto>(`/org/numbatrak/product-offers/${offerId}`, {
    method: "PATCH",
    body: {
      variantId: input.variant_id,
      offerType: input.offer_type,
      label: input.label,
      minQuantity: input.min_quantity,
      freeQuantity: input.free_quantity,
      bundleItems: input.bundle_items,
      price: input.price,
      unitCost: input.unit_cost,
      active: input.active,
      startsAt: input.starts_at,
      endsAt: input.ends_at,
      displayOrder: input.display_order,
    },
  });
  return offerFromDto(dto);
}

export async function removeProductOffer(offerId: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/product-offers/${offerId}`, { method: "DELETE" });
}

export async function setProductOfferActive(offerId: string, active: boolean): Promise<ProductOffer> {
  return updateProductOffer(offerId, { active });
}
