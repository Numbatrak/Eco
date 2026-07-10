import { z } from "zod";

// ---------- products ----------

export const productStatusSchema = z.enum(["draft", "published"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productSchema = z.object({
  id: z.string().uuid(),
  // Organization id (Better Auth's text-typed ids, not a uuid column).
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  imageUrl: z.string().nullable(),
  status: productStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  imageUrl: z.string().url().optional(),
  status: productStatusSchema.optional(),
});
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

export const updateProductRequestSchema = createProductRequestSchema.partial();
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;

// ---------- cart ----------

export const cartItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceSnapshotCents: z.number().int().nonnegative(),
  lineTotalCents: z.number().int().nonnegative(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().uuid(),
  items: z.array(cartItemSchema),
  subtotalCents: z.number().int().nonnegative(),
  currency: z.string().length(3).nullable(),
});
export type Cart = z.infer<typeof cartSchema>;

export const addCartItemRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
});
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().positive().max(999),
});
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;

// ---------- checkout ----------

export const checkoutRequestSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().email(),
  customerPhone: z.string().trim().max(32).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  checkoutUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderStatusValueSchema = z.enum(["pending", "paid", "failed", "cancelled"]);
export type OrderStatusValue = z.infer<typeof orderStatusValueSchema>;

export const orderStatusResponseSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  status: orderStatusValueSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string(),
});
export type OrderStatusResponse = z.infer<typeof orderStatusResponseSchema>;

// ---------- payment settings ----------

export const paymentProviderKeySchema = z.enum(["paystack", "flutterwave"]);
export type PaymentProviderKey = z.infer<typeof paymentProviderKeySchema>;

export const paymentModeSchema = z.enum(["test", "live"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const paymentSettingsRequestSchema = z.object({
  provider: paymentProviderKeySchema,
  publicKey: z.string().trim().min(1),
  secretKey: z.string().trim().min(1),
  mode: paymentModeSchema,
  // Required (password always, code only if the user has 2FA enabled) when
  // mode is "live" - this is the re-auth bar for real money movement,
  // verified server-side. Not needed for test mode.
  password: z.string().optional(),
  code: z.string().optional(),
});
export type PaymentSettingsRequest = z.infer<typeof paymentSettingsRequestSchema>;

export const paymentSettingsResponseSchema = z.object({
  provider: paymentProviderKeySchema.nullable(),
  mode: paymentModeSchema.nullable(),
  enabled: z.boolean(),
  hasSecretKey: z.boolean(),
  publicKey: z.string().nullable(),
});
export type PaymentSettingsResponse = z.infer<typeof paymentSettingsResponseSchema>;

// ---------- orders (merchant-facing) ----------

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  nameSnapshot: z.string(),
  unitPriceSnapshotCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  lineTotalCents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  customerName: z.string(),
  status: orderStatusValueSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string(),
  createdAt: z.string(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderDetailSchema = orderSummarySchema.extend({
  customerEmail: z.string(),
  customerPhone: z.string().nullable(),
  subtotalCents: z.number().int().nonnegative(),
  paymentProvider: paymentProviderKeySchema,
  paymentReference: z.string().nullable(),
  items: z.array(orderItemSchema),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

// ---------- tenant site settings ----------

export const updateTenantRequestSchema = z.object({
  subdomain: z.string().trim().min(3).max(63).optional(),
  published: z.boolean().optional(),
  showProductGrid: z.boolean().optional(),
});
export type UpdateTenantRequest = z.infer<typeof updateTenantRequestSchema>;

export const tenantSettingsResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string().nullable(),
  published: z.boolean(),
  showProductGrid: z.boolean(),
});
export type TenantSettingsResponse = z.infer<typeof tenantSettingsResponseSchema>;

// ---------- public site (storefront) ----------

export const publicSiteProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string(),
  imageUrl: z.string().nullable(),
});
export type PublicSiteProduct = z.infer<typeof publicSiteProductSchema>;

import { siteThemeSchema, siteSectionSchema } from "./site-config.js";

export const publicSiteSchema = z.object({
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    subdomain: z.string(),
  }),
  theme: siteThemeSchema,
  sections: z.array(siteSectionSchema),
  productsGridEnabled: z.boolean(),
  products: z.array(publicSiteProductSchema),
});
export type PublicSite = z.infer<typeof publicSiteSchema>;
