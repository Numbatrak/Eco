"use client";

import { apiRequest } from "../lib/apiClient";
import { Product, ProductPerformance, ProductPrice, ProductWithDetails, ProductWithPrices } from "../types/product";
import { emptyWithoutOrg } from "./orgQuery";

interface ProductDetailsDto {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
  basePrice: string;
  costPrice: string;
  type: "NORMAL" | "INCENTIVE";
  category: string | null;
  subBrand: string | null;
  lowStockThreshold: number | null;
  allowsVariants: boolean;
  allowsBundles: boolean;
  allowsDiscounts: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  variants: Array<{
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
  }>;
  offers: Array<{
    id: string;
    organizationId: string;
    productId: string;
    variantId: string | null;
    offerType: "single" | "quantity_tier" | "bundle" | "buy_x_get_y";
    label: string;
    minQuantity: number;
    freeQuantity: number;
    bundleItems: Array<{ productId: string; variantId?: string | null; quantity: number }> | null;
    price: string;
    unitCost: string;
    active: boolean;
    startsAt: string | null;
    endsAt: string | null;
    displayOrder: number;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  stockOnHand: number;
  performance: { unitsSold: number; revenue: number; margin: number } | null;
}

function detailsToProductWithDetails(dto: ProductDetailsDto): ProductWithDetails {
  return {
    id: dto.id,
    organization_id: "",
    name: dto.name,
    sku: dto.sku,
    type: dto.type,
    base_price: Number(dto.basePrice),
    cost_price: Number(dto.costPrice),
    active: dto.active,
    low_stock_threshold: dto.lowStockThreshold,
    category: dto.category,
    sub_brand: dto.subBrand,
    allows_variants: dto.allowsVariants,
    allows_bundles: dto.allowsBundles,
    allows_discounts: dto.allowsDiscounts,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    prices: [],
    variants: dto.variants.map((v) => ({
      id: v.id,
      organization_id: v.organizationId,
      product_id: v.productId,
      name: v.name,
      sku: v.sku,
      base_price: Number(v.basePrice),
      cost_price: Number(v.costPrice),
      active: v.active,
      display_order: v.displayOrder,
      created_at: v.createdAt,
      updated_at: v.updatedAt,
    })),
    offers: dto.offers.map((o) => ({
      id: o.id,
      organization_id: o.organizationId,
      product_id: o.productId,
      variant_id: o.variantId,
      offer_type: o.offerType,
      label: o.label,
      min_quantity: o.minQuantity,
      free_quantity: o.freeQuantity,
      bundle_items:
        o.bundleItems?.map((b) => ({ product_id: b.productId, variant_id: b.variantId ?? null, quantity: b.quantity })) ??
        null,
      price: Number(o.price),
      unit_cost: Number(o.unitCost),
      active: o.active,
      starts_at: o.startsAt,
      ends_at: o.endsAt,
      display_order: o.displayOrder,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    })),
    stock_on_hand: dto.stockOnHand,
    performance: dto.performance
      ? { units_sold: dto.performance.unitsSold, revenue: dto.performance.revenue, margin: dto.performance.margin }
      : undefined,
  };
}

/**
 * Plain product list. Hits the same /details endpoint as
 * fetchProductsWithDetails and maps down to the base Product shape - keeps
 * one backend round trip instead of maintaining two overlapping routes.
 */
export async function fetchProducts(
  organizationId: string | null,
  options?: { activeOnly?: boolean }
): Promise<Product[]> {
  const empty = emptyWithoutOrg<Product>(organizationId);
  if (empty) return empty;

  const { products } = await apiRequest<{ products: ProductDetailsDto[] }>("/org/numbatrak/products/details");
  const mapped = products.map(detailsToProductWithDetails) as Product[];
  return options?.activeOnly ? mapped.filter((p) => p.active !== false) : mapped;
}

export async function fetchProductsWithPrices(
  organizationId: string | null
): Promise<ProductWithPrices[]> {
  return fetchProductsWithDetails(organizationId);
}

export async function fetchProductsWithDetails(
  organizationId: string | null
): Promise<ProductWithDetails[]> {
  const empty = emptyWithoutOrg<ProductWithDetails>(organizationId);
  if (empty) return empty;

  const { products } = await apiRequest<{ products: ProductDetailsDto[] }>("/org/numbatrak/products/details");
  return products.map(detailsToProductWithDetails);
}

/**
 * @deprecated Units sold/revenue/margin now come back inline on each row
 * from fetchProductsWithDetails - this standalone fetch is unused by the
 * ported UI but kept for signature compatibility.
 */
export async function fetchProductPerformance(
  organizationId: string | null,
  productIds?: string[]
): Promise<Record<string, ProductPerformance>> {
  const result: Record<string, ProductPerformance> = {};
  if (!organizationId) return result;
  const products = await fetchProductsWithDetails(organizationId);
  for (const p of products) {
    if (productIds && !productIds.includes(p.id)) continue;
    if (p.performance) result[p.id] = p.performance;
  }
  return result;
}

/**
 * @deprecated Legacy multi-tier price list, superseded by typed offers
 * (product_offers) - the source app's own PriceDialog.tsx that read this is
 * dead/unrouted code. Kept only for signature compatibility; always empty.
 */
export async function fetchProductPrices(_productId: number | string): Promise<ProductPrice[]> {
  return [];
}

export async function createProduct(input: {
  name: string;
  organization_id: string;
  base_price: number;
  cost_price: number;
  type?: "NORMAL" | "INCENTIVE";
  sku?: string | null;
  category?: string | null;
  sub_brand?: string | null;
  low_stock_threshold?: number | null;
  allows_variants?: boolean;
  allows_bundles?: boolean;
  allows_discounts?: boolean;
}): Promise<Product> {
  if (input.base_price == null || isNaN(input.base_price) || input.base_price < 0) {
    throw new Error("base_price is required and must be a valid number ≥ 0");
  }
  if (input.cost_price == null || isNaN(input.cost_price) || input.cost_price < 0) {
    throw new Error("cost_price is required and must be a valid number ≥ 0");
  }

  const dto = await apiRequest<{
    id: string;
    name: string;
    sku: string | null;
    active: boolean;
    basePrice: string;
    costPrice: string;
  }>("/org/numbatrak/products", {
    method: "POST",
    body: {
      name: input.name,
      basePrice: input.base_price,
      costPrice: input.cost_price,
      type: input.type,
      sku: input.sku ?? null,
      category: input.category ?? null,
      subBrand: input.sub_brand ?? null,
      lowStockThreshold: input.low_stock_threshold ?? null,
      allowsVariants: input.allows_variants ?? false,
      allowsBundles: input.allows_bundles ?? false,
      allowsDiscounts: input.allows_discounts ?? false,
    },
  });

  return {
    id: dto.id,
    organization_id: input.organization_id,
    name: dto.name,
    sku: dto.sku,
    type: input.type ?? "NORMAL",
    base_price: Number(dto.basePrice),
    cost_price: Number(dto.costPrice),
    active: dto.active,
    low_stock_threshold: input.low_stock_threshold ?? null,
    category: input.category ?? null,
    sub_brand: input.sub_brand ?? null,
    allows_variants: input.allows_variants ?? false,
    allows_bundles: input.allows_bundles ?? false,
    allows_discounts: input.allows_discounts ?? false,
    created_at: null,
    updated_at: null,
  };
}

export async function updateProduct(
  productId: string | number,
  input: {
    name?: string;
    base_price?: number;
    cost_price?: number;
    type?: "NORMAL" | "INCENTIVE";
    sku?: string | null;
    active?: boolean;
    category?: string | null;
    sub_brand?: string | null;
    low_stock_threshold?: number | null;
    allows_variants?: boolean;
    allows_bundles?: boolean;
    allows_discounts?: boolean;
  }
): Promise<Product> {
  const dto = await apiRequest<{
    id: string;
    name: string;
    sku: string | null;
    active: boolean;
    basePrice: string;
    costPrice: string;
  }>(`/org/numbatrak/products/${productId}`, {
    method: "PATCH",
    body: {
      name: input.name,
      basePrice: input.base_price,
      costPrice: input.cost_price,
      type: input.type,
      sku: input.sku,
      active: input.active,
      category: input.category,
      subBrand: input.sub_brand,
      lowStockThreshold: input.low_stock_threshold,
      allowsVariants: input.allows_variants,
      allowsBundles: input.allows_bundles,
      allowsDiscounts: input.allows_discounts,
    },
  });

  return {
    id: dto.id,
    organization_id: "",
    name: dto.name,
    sku: dto.sku,
    type: input.type,
    base_price: Number(dto.basePrice),
    cost_price: Number(dto.costPrice),
    active: dto.active,
    low_stock_threshold: input.low_stock_threshold,
    category: input.category,
    sub_brand: input.sub_brand,
    allows_variants: input.allows_variants,
    allows_bundles: input.allows_bundles,
    allows_discounts: input.allows_discounts,
    created_at: null,
    updated_at: null,
  };
}

export async function setProductActive(productId: string | number, active: boolean): Promise<Product> {
  return updateProduct(productId, { active });
}

export async function removeProduct(productId: string | number): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/products/${productId}`, { method: "DELETE" });
}

/**
 * @deprecated Legacy multi-tier price CRUD (product_prices /
 * product_price_history) - source app's PriceDialog.tsx, the only consumer,
 * is dead/unrouted code (not imported by ProductsForm.tsx or anywhere else).
 * Not ported; throws if actually called.
 */
export async function createProductPrice(_input: unknown): Promise<ProductPrice> {
  throw new Error("Legacy price-tier entries aren't ported to the new backend.");
}

/** @deprecated See createProductPrice. */
export async function updateProductPrice(_priceId: number, _input: unknown): Promise<ProductPrice> {
  throw new Error("Legacy price-tier entries aren't ported to the new backend.");
}

/** @deprecated See createProductPrice. */
export async function removeProductPrice(_priceId: number | string): Promise<void> {
  throw new Error("Legacy price-tier entries aren't ported to the new backend.");
}

/**
 * @deprecated Only used by dead/unrouted components/orders/OrderDialog.tsx
 * (legacy orders UI, not reachable from App.tsx). Not ported; throws if
 * actually called.
 */
export async function getProductPriceByName(
  _productName: string,
  _organizationId: string | null,
  _orderDate: string,
  _quantity: number = 1
): Promise<{ unit_cost: number; sales_price: number; offer: number } | null> {
  throw new Error("getProductPriceByName isn't ported to the new backend (dead code path).");
}
