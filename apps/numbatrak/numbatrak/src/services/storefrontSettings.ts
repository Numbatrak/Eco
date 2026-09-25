import { apiRequest } from "../lib/apiClient";

/**
 * Ported from apps/storefront's commerceApi.ts - same endpoints, same
 * backend (apps/api's modules/{sites,payments,delivery,analytics}). Types
 * mirror @platform/shared-types/commerce.ts by hand (see src/types/siteConfig.ts
 * for why numbatrak can't import that package directly).
 */

export type PaymentProviderKey = "paystack" | "flutterwave";
export type PaymentMode = "test" | "live";

export interface PaymentSettingsRequest {
  provider: PaymentProviderKey;
  publicKey: string;
  secretKey: string;
  mode: PaymentMode;
  /** Required (password always, code only if the user has 2FA enabled) when mode is "live". */
  password?: string;
  code?: string;
}

export interface PaymentSettingsResponse {
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

export interface AnalyticsSettingsRequest {
  metaPixelId: string;
  metaCapiToken: string;
  enabled: boolean;
}

export interface AnalyticsSettingsResponse {
  metaPixelId: string | null;
  hasCapiToken: boolean;
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
};
