"use client";

import type {
  CreateProductRequest,
  Product,
  UpdateProductRequest,
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  ProductVariant,
  CreateVariantRequest,
  UpdateVariantRequest,
  OrderSummary,
  OrderDetail,
  OrderStatusValue,
  Customer,
  PaymentSettingsRequest,
  PaymentSettingsResponse,
  DeliverySettingsRequest,
  DeliverySettingsResponse,
  AnalyticsSettingsRequest,
  AnalyticsSettingsResponse,
  UpdateTenantRequest,
  TenantSettingsResponse,
} from "@platform/shared-types";
import { apiRequest } from "./apiClient";

/**
 * Every route below is scoped to the caller's session's active organization
 * server-side (see apps/api's org-access preHandler) - no tenant/org id
 * travels in the URL or a token anymore, just the session cookie.
 */
export const commerceApi = {
  listProducts: () => apiRequest<{ products: Product[] }>("/org/products", { method: "GET" }),

  getProduct: (productId: string) =>
    apiRequest<Product>(`/org/products/${productId}`, { method: "GET" }),

  createProduct: (body: CreateProductRequest) =>
    apiRequest<Product>("/org/products", { method: "POST", body }),

  updateProduct: (productId: string, body: UpdateProductRequest) =>
    apiRequest<Product>(`/org/products/${productId}`, { method: "PATCH", body }),

  deleteProduct: (productId: string) =>
    apiRequest<void>(`/org/products/${productId}`, { method: "DELETE" }),

  listVariants: (productId: string) =>
    apiRequest<{ variants: ProductVariant[] }>(`/org/products/${productId}/variants`, { method: "GET" }),

  createVariant: (productId: string, body: CreateVariantRequest) =>
    apiRequest<ProductVariant>(`/org/products/${productId}/variants`, { method: "POST", body }),

  updateVariant: (productId: string, variantId: string, body: UpdateVariantRequest) =>
    apiRequest<ProductVariant>(`/org/products/${productId}/variants/${variantId}`, {
      method: "PATCH",
      body,
    }),

  deleteVariant: (productId: string, variantId: string) =>
    apiRequest<void>(`/org/products/${productId}/variants/${variantId}`, { method: "DELETE" }),

  listCollections: () =>
    apiRequest<{ collections: Collection[] }>("/org/collections", { method: "GET" }),

  getCollection: (collectionId: string) =>
    apiRequest<Collection>(`/org/collections/${collectionId}`, { method: "GET" }),

  createCollection: (body: CreateCollectionRequest) =>
    apiRequest<Collection>("/org/collections", { method: "POST", body }),

  updateCollection: (collectionId: string, body: UpdateCollectionRequest) =>
    apiRequest<Collection>(`/org/collections/${collectionId}`, { method: "PATCH", body }),

  deleteCollection: (collectionId: string) =>
    apiRequest<void>(`/org/collections/${collectionId}`, { method: "DELETE" }),

  listOrders: (customerId?: string) =>
    apiRequest<{ orders: OrderSummary[] }>(
      customerId ? `/org/orders?customerId=${customerId}` : "/org/orders",
      { method: "GET" },
    ),

  getOrder: (orderId: string) => apiRequest<OrderDetail>(`/org/orders/${orderId}`, { method: "GET" }),

  updateOrderStatus: (orderId: string, status: OrderStatusValue) =>
    apiRequest<void>(`/org/orders/${orderId}/status`, { method: "PATCH", body: { status } }),

  listCustomers: () =>
    apiRequest<{ customers: Customer[] }>("/org/customers", { method: "GET" }),

  getCustomer: (customerId: string) =>
    apiRequest<Customer>(`/org/customers/${customerId}`, { method: "GET" }),

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
};
