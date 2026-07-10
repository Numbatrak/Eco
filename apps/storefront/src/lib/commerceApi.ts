"use client";

import type {
  CreateProductRequest,
  Product,
  UpdateProductRequest,
  OrderSummary,
  OrderDetail,
  PaymentSettingsRequest,
  PaymentSettingsResponse,
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

  listOrders: () => apiRequest<{ orders: OrderSummary[] }>("/org/orders", { method: "GET" }),

  getOrder: (orderId: string) => apiRequest<OrderDetail>(`/org/orders/${orderId}`, { method: "GET" }),

  getPaymentSettings: () =>
    apiRequest<PaymentSettingsResponse>("/org/payment-settings", { method: "GET" }),

  savePaymentSettings: (body: PaymentSettingsRequest) =>
    apiRequest<PaymentSettingsResponse>("/org/payment-settings", { method: "PUT", body }),

  getTenantSettings: () =>
    apiRequest<TenantSettingsResponse>("/org/site-settings", { method: "GET" }),

  updateTenantSettings: (body: UpdateTenantRequest) =>
    apiRequest<void>("/org/site-settings", { method: "PATCH", body }),
};
