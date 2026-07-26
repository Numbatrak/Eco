export type ProductType = "NORMAL" | "INCENTIVE";

export type ProductOfferType =
  | "single"
  | "quantity_tier"
  | "bundle"
  | "buy_x_get_y";

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku?: string | null;
  type?: ProductType;
  base_price?: number;
  cost_price?: number;
  active?: boolean;
  low_stock_threshold?: number | null;
  category?: string | null;
  sub_brand?: string | null;
  allows_variants?: boolean;
  allows_bundles?: boolean;
  allows_discounts?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

/** @deprecated Use ProductOffer for typed offers */
export interface ProductPrice {
  id: number | string;
  product_id: number | string;
  date: string;
  quantity: number;
  offer: number;
  sales_price: number;
  unit_cost: number;
  created_at?: string | null;
}

export interface ProductVariant {
  id: string;
  organization_id: string;
  product_id: string;
  name: string;
  sku?: string | null;
  base_price: number;
  cost_price: number;
  active: boolean;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductOfferBundleItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface ProductOffer {
  id: string;
  organization_id: string;
  product_id: string;
  variant_id?: string | null;
  offer_type: ProductOfferType;
  label: string;
  min_quantity: number;
  free_quantity: number;
  bundle_items?: ProductOfferBundleItem[] | null;
  price: number;
  unit_cost: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductPerformance {
  units_sold: number;
  revenue: number;
  margin: number;
}

export interface ProductWithDetails extends Product {
  /** @deprecated Legacy price history rows */
  prices: ProductPrice[];
  offers: ProductOffer[];
  variants: ProductVariant[];
  stock_on_hand?: number;
  performance?: ProductPerformance;
}

/** @deprecated Alias for ProductWithDetails */
export type ProductWithPrices = ProductWithDetails;

export const OFFER_TYPE_LABELS: Record<ProductOfferType, string> = {
  single: "Single",
  quantity_tier: "Quantity tier",
  bundle: "Bundle",
  buy_x_get_y: "Buy X get Y",
};

/** Accord rule: physical units including free items */
export function computeTrueUnitCount(
  quantityPaid: number,
  freeQuantity: number
): number {
  return quantityPaid + freeQuantity;
}

/** Buy-X-get-Y bundle count → paid/free/true units */
export function computeBuyXGetYUnits(
  bundleCount: number,
  minQuantity: number,
  freeQuantity: number
): { quantity_paid: number; free_quantity: number; true_unit_count: number } {
  const quantity_paid = bundleCount * minQuantity;
  const free_quantity = bundleCount * freeQuantity;
  return {
    quantity_paid,
    free_quantity,
    true_unit_count: quantity_paid + free_quantity,
  };
}
