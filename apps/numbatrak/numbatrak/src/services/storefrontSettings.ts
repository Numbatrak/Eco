import { apiRequest } from "../lib/apiClient";

/**
 * Ported from apps/storefront's commerceApi.ts - same endpoints, same
 * backend (apps/api's modules/{sites,payments,delivery,analytics}). Types
 * mirror @platform/shared-types/commerce.ts by hand (see src/types/siteConfig.ts
 * for why numbatrak can't import that package directly).
 */

export type PaymentProviderKey = "paystack" | "flutterwave";
export type PaymentMode = "test" | "live";
/** "both" lets the buyer choose COD vs Pay Now at checkout. */
export type PaymentCollectionMethod = "cod" | "prepaid" | "both";

export interface PaymentSettingsRequest {
  collectionMethod: PaymentCollectionMethod;
  /** Only required when collectionMethod isn't "cod" - a pure COD store needs no gateway. */
  provider?: PaymentProviderKey;
  publicKey?: string;
  secretKey?: string;
  mode?: PaymentMode;
  /** Required (password always, code only if the user has 2FA enabled) when mode is "live". */
  password?: string;
  code?: string;
}

export interface PaymentSettingsResponse {
  collectionMethod: PaymentCollectionMethod | null;
  provider: PaymentProviderKey | null;
  mode: PaymentMode | null;
  enabled: boolean;
  hasSecretKey: boolean;
  publicKey: string | null;
}

export interface DeliverySettingsRequest {
  vatEnabled: boolean;
  vatRateBps: number;
  deliveryFeeCents: number;
  freeDeliveryThresholdCents?: number | null;
}

export interface DeliverySettingsResponse {
  vatEnabled: boolean;
  vatRateBps: number;
  deliveryFeeCents: number;
  freeDeliveryThresholdCents: number | null;
}

/** Per-state fee override for storefront checkout - matches
 * @platform/shared-types/nigeria-states.ts's NIGERIA_STATES list exactly
 * (see constants/nigeriaStates.ts for numbatrak's hand-mirrored copy). */
export interface DeliveryZoneRate {
  state: string;
  feeCents: number;
}

export interface DeliveryZoneRatesRequest {
  rates: DeliveryZoneRate[];
}

export interface DeliveryZoneRatesResponse {
  rates: DeliveryZoneRate[];
}

export interface AnalyticsSettingsRequest {
  metaPixelId: string;
  metaCapiToken: string;
  tiktokPixelId: string;
  tiktokCapiToken: string;
  enabled: boolean;
}

export interface AnalyticsSettingsResponse {
  metaPixelId: string | null;
  hasCapiToken: boolean;
  tiktokPixelId: string | null;
  hasTiktokCapiToken: boolean;
  enabled: boolean;
}

export interface UpdateTenantRequest {
  subdomain?: string;
  published?: boolean;
  showProductGrid?: boolean;
}

export interface TenantSettingsResponse {
  id: string;
  name: string;
  subdomain: string | null;
  published: boolean;
  showProductGrid: boolean;
}

// ---------- discounts ----------
// Mirrors @platform/shared-types/discount-config.ts by hand (see file header).

export type DiscountValueType = "percentage" | "fixed_amount";

export interface AmountOffOrderConfig {
  type: "amount_off_order";
  valueType: DiscountValueType;
  value: number;
  minimumSubtotalCents?: number;
}

export interface AmountOffProductsConfig {
  type: "amount_off_products";
  valueType: DiscountValueType;
  value: number;
  targetProductIds: string[];
  targetCollectionIds: string[];
}

export interface BuyXGetYConfig {
  type: "buy_x_get_y";
  buyProductId: string;
  buyQuantity: number;
  getProductId: string;
  getQuantity: number;
  /** 100 = the "get" item is free; anything less is a partial discount on it. */
  getDiscountPercent: number;
}

export interface FreeShippingConfig {
  type: "free_shipping";
  minimumSubtotalCents?: number;
}

export type DiscountConfig =
  | AmountOffOrderConfig
  | AmountOffProductsConfig
  | BuyXGetYConfig
  | FreeShippingConfig;
export type DiscountType = DiscountConfig["type"];

export interface DiscountRequest {
  /** Null/omitted = an automatic discount (no code needed at checkout). */
  code?: string | null;
  title: string;
  active?: boolean;
  config: DiscountConfig;
}

export interface DiscountResponse {
  id: string;
  tenantId: string;
  code: string | null;
  title: string;
  active: boolean;
  config: DiscountConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappSettingsResponse {
  connected: boolean;
  wabaId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  accountStatus: "pending" | "approved" | "rejected" | null;
  enabled: boolean;
}

export interface WhatsappConnectRequest {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

/**
 * The storefront/commerce product (packages/db's `products` table, id space
 * used by tenant_site_config.funnelProductId and product_funnel_config) -
 * distinct from this app's own inventory Product type in types/product.ts,
 * which is a different table (numbatrak_products) with different ids.
 */
export interface StorefrontProduct {
  id: string;
  name: string;
}

export const storefrontSettingsApi = {
  getPaymentSettings: () =>
    apiRequest<PaymentSettingsResponse>("/org/payment-settings", { method: "GET" }),

  savePaymentSettings: (body: PaymentSettingsRequest) =>
    apiRequest<PaymentSettingsResponse>("/org/payment-settings", { method: "PUT", body }),

  getDeliverySettings: () =>
    apiRequest<DeliverySettingsResponse>("/org/delivery-settings", { method: "GET" }),

  saveDeliverySettings: (body: DeliverySettingsRequest) =>
    apiRequest<DeliverySettingsResponse>("/org/delivery-settings", { method: "PUT", body }),

  getDeliveryZones: () =>
    apiRequest<DeliveryZoneRatesResponse>("/org/delivery-zones", { method: "GET" }),

  saveDeliveryZones: (body: DeliveryZoneRatesRequest) =>
    apiRequest<DeliveryZoneRatesResponse>("/org/delivery-zones", { method: "PUT", body }),

  getAnalyticsSettings: () =>
    apiRequest<AnalyticsSettingsResponse>("/org/analytics-settings", { method: "GET" }),

  saveAnalyticsSettings: (body: AnalyticsSettingsRequest) =>
    apiRequest<AnalyticsSettingsResponse>("/org/analytics-settings", { method: "PUT", body }),

  getTenantSettings: () =>
    apiRequest<TenantSettingsResponse>("/org/site-settings", { method: "GET" }),

  updateTenantSettings: (body: UpdateTenantRequest) =>
    apiRequest<void>("/org/site-settings", { method: "PATCH", body }),

  getWhatsappSettings: () =>
    apiRequest<WhatsappSettingsResponse>("/org/whatsapp-settings", { method: "GET" }),

  connectWhatsapp: (body: WhatsappConnectRequest) =>
    apiRequest<WhatsappSettingsResponse>("/org/whatsapp/connect", { method: "POST", body }),

  disconnectWhatsapp: () =>
    apiRequest<{ success: boolean }>("/org/whatsapp/disconnect", { method: "DELETE" }),

  listStorefrontProducts: () =>
    apiRequest<{ products: StorefrontProduct[] }>("/org/products", { method: "GET" }),

  listDiscounts: () =>
    apiRequest<{ discounts: DiscountResponse[] }>("/org/discounts", { method: "GET" }),

  getDiscount: (discountId: string) =>
    apiRequest<DiscountResponse>(`/org/discounts/${discountId}`, { method: "GET" }),

  createDiscount: (body: DiscountRequest) =>
    apiRequest<DiscountResponse>("/org/discounts", { method: "POST", body }),

  updateDiscount: (discountId: string, body: Partial<DiscountRequest>) =>
    apiRequest<DiscountResponse>(`/org/discounts/${discountId}`, { method: "PATCH", body }),

  deleteDiscount: (discountId: string) =>
    apiRequest<void>(`/org/discounts/${discountId}`, { method: "DELETE" }),
};
