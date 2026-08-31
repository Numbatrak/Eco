import type {
  Cart,
  AddCartItemRequest,
  UpdateCartItemRequest,
  CheckoutRequest,
  CheckoutResponse,
  OrderStatusResponse,
  DeliveryQuoteResponse,
  DiscountCodePreviewResponse,
} from "@platform/shared-types";
import { apiRequest } from "./apiClient";

export const cartApi = {
  createCart: (subdomain: string) =>
    apiRequest<Cart>(`/public/sites/${subdomain}/cart`, { method: "POST" }),

  getCart: (subdomain: string) => apiRequest<Cart>(`/public/sites/${subdomain}/cart`),

  addItem: (subdomain: string, body: AddCartItemRequest) =>
    apiRequest<Cart>(`/public/sites/${subdomain}/cart/items`, { method: "POST", body }),

  updateItem: (subdomain: string, itemId: string, body: UpdateCartItemRequest) =>
    apiRequest<Cart>(`/public/sites/${subdomain}/cart/items/${itemId}`, {
      method: "PATCH",
      body,
    }),

  removeItem: (subdomain: string, itemId: string) =>
    apiRequest<Cart>(`/public/sites/${subdomain}/cart/items/${itemId}`, { method: "DELETE" }),

  checkout: (subdomain: string, body: CheckoutRequest) =>
    apiRequest<CheckoutResponse>(`/public/sites/${subdomain}/checkout`, { method: "POST", body }),

  getDeliveryQuote: (subdomain: string, subtotalCents: number, state?: string) =>
    apiRequest<DeliveryQuoteResponse>(
      `/public/sites/${subdomain}/delivery-quote?subtotalCents=${subtotalCents}${
        state ? `&state=${encodeURIComponent(state)}` : ""
      }`,
    ),

  validateDiscountCode: (subdomain: string, code: string) =>
    apiRequest<DiscountCodePreviewResponse>(`/public/sites/${subdomain}/discount-code/validate`, {
      method: "POST",
      body: { code },
    }),

  getOrderStatus: (subdomain: string, orderId: string) =>
    apiRequest<OrderStatusResponse>(`/public/sites/${subdomain}/checkout/${orderId}/status`),
};
