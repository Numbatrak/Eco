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

export const commerceApi = {
  listProducts: (accessToken: string, tenantId: string) =>
    apiRequest<{ products: Product[] }>(`/tenants/${tenantId}/products`, {
      method: "GET",
      accessToken,
    }),

  getProduct: (accessToken: string, tenantId: string, productId: string) =>
    apiRequest<Product>(`/tenants/${tenantId}/products/${productId}`, {
      method: "GET",
      accessToken,
    }),

  createProduct: (accessToken: string, tenantId: string, body: CreateProductRequest) =>
    apiRequest<Product>(`/tenants/${tenantId}/products`, { method: "POST", accessToken, body }),

  updateProduct: (
    accessToken: string,
    tenantId: string,
    productId: string,
    body: UpdateProductRequest,
  ) =>
    apiRequest<Product>(`/tenants/${tenantId}/products/${productId}`, {
      method: "PATCH",
      accessToken,
      body,
    }),

  deleteProduct: (accessToken: string, tenantId: string, productId: string) =>
    apiRequest<void>(`/tenants/${tenantId}/products/${productId}`, {
      method: "DELETE",
      accessToken,
    }),

  listOrders: (accessToken: string, tenantId: string) =>
    apiRequest<{ orders: OrderSummary[] }>(`/tenants/${tenantId}/orders`, {
      method: "GET",
      accessToken,
    }),

  getOrder: (accessToken: string, tenantId: string, orderId: string) =>
    apiRequest<OrderDetail>(`/tenants/${tenantId}/orders/${orderId}`, {
      method: "GET",
      accessToken,
    }),

  getPaymentSettings: (accessToken: string, tenantId: string) =>
    apiRequest<PaymentSettingsResponse>(`/tenants/${tenantId}/payment-settings`, {
      method: "GET",
      accessToken,
    }),

  savePaymentSettings: (accessToken: string, tenantId: string, body: PaymentSettingsRequest) =>
    apiRequest<PaymentSettingsResponse>(`/tenants/${tenantId}/payment-settings`, {
      method: "PUT",
      accessToken,
      body,
    }),

  getTenantSettings: (accessToken: string, tenantId: string) =>
    apiRequest<TenantSettingsResponse>(`/tenants/${tenantId}`, { method: "GET", accessToken }),

  updateTenantSettings: (accessToken: string, tenantId: string, body: UpdateTenantRequest) =>
    apiRequest<void>(`/tenants/${tenantId}`, { method: "PATCH", accessToken, body }),
};
