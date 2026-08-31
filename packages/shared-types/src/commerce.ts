import { z } from "zod";
import { nigeriaStateSchema } from "./nigeria-states.js";

// ---------- collections ----------

const collectionSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

export const collectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;

export const createCollectionRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: collectionSlugSchema,
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type CreateCollectionRequest = z.infer<typeof createCollectionRequestSchema>;

export const updateCollectionRequestSchema = createCollectionRequestSchema.partial();
export type UpdateCollectionRequest = z.infer<typeof updateCollectionRequestSchema>;

// ---------- product variants ----------

export const productVariantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  size: z.string(),
  color: z.string(),
  stockCount: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const createVariantRequestSchema = z.object({
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(50),
  stockCount: z.number().int().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
});
export type CreateVariantRequest = z.infer<typeof createVariantRequestSchema>;

export const updateVariantRequestSchema = createVariantRequestSchema.partial();
export type UpdateVariantRequest = z.infer<typeof updateVariantRequestSchema>;

// ---------- products ----------

export const productStatusSchema = z.enum(["draft", "published"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productSchema = z.object({
  id: z.string().uuid(),
  // Organization id (Better Auth's text-typed ids, not a uuid column).
  tenantId: z.string(),
  collectionId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  // Set only when the product is on sale, for strike-through display.
  compareAtPriceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3),
  imageUrl: z.string().nullable(),
  status: productStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductRequestSchema = z.object({
  collectionId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().nullable().optional(),
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
  variantId: z.string().uuid().nullable(),
  // e.g. "M / Blue" - built server-side by joining the variant's size/color.
  variantLabel: z.string().nullable(),
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
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(999),
});
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().positive().max(999),
});
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;

// ---------- delivery + VAT ----------

export const deliverySettingsRequestSchema = z.object({
  vatEnabled: z.boolean(),
  vatRateBps: z.number().int().min(0).max(10000),
  deliveryFeeCents: z.number().int().nonnegative(),
  freeDeliveryThresholdCents: z.number().int().nonnegative().nullable().optional(),
});
export type DeliverySettingsRequest = z.infer<typeof deliverySettingsRequestSchema>;

export const deliverySettingsResponseSchema = z.object({
  vatEnabled: z.boolean(),
  vatRateBps: z.number().int(),
  deliveryFeeCents: z.number().int().nonnegative(),
  freeDeliveryThresholdCents: z.number().int().nonnegative().nullable(),
});
export type DeliverySettingsResponse = z.infer<typeof deliverySettingsResponseSchema>;

export const deliveryQuoteResponseSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  qualifiesForFreeDelivery: z.boolean(),
  freeDeliveryThresholdCents: z.number().int().nonnegative().nullable(),
  vat: z.object({
    enabled: z.boolean(),
    rateBps: z.number().int(),
    amountCents: z.number().int().nonnegative(),
  }),
});
export type DeliveryQuoteResponse = z.infer<typeof deliveryQuoteResponseSchema>;

// ---------- checkout ----------

export const checkoutRequestSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().email(),
  customerPhone: z.string().trim().max(32).optional(),
  deliveryAddress: z.string().trim().min(1).max(500),
  deliveryCity: z.string().trim().min(1).max(200),
  deliveryState: nigeriaStateSchema,
  attribution: z
    .object({
      utmSource: z.string().trim().max(200).optional(),
      utmMedium: z.string().trim().max(200).optional(),
      utmCampaign: z.string().trim().max(200).optional(),
      utmTerm: z.string().trim().max(200).optional(),
      utmContent: z.string().trim().max(200).optional(),
      referrer: z.string().trim().max(2000).optional(),
      landingPath: z.string().trim().max(2000).optional(),
      fbclid: z.string().trim().max(500).optional(),
      ttclid: z.string().trim().max(500).optional(),
      gclid: z.string().trim().max(500).optional(),
    })
    .optional(),
  // The buyer's choice at checkout - only meaningful (and required, checked
  // server-side against the tenant's collection method) when that tenant
  // allows "both". Ignored otherwise.
  paymentMethod: z.enum(["cod", "online"]).optional(),
  // Which selling surface this order came from - defaults to "store" when
  // omitted (the regular cart/checkout flow).
  source: z.enum(["store", "funnel"]).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  // Null for a COD order - it's already placed, nothing to redirect to.
  checkoutUrl: z.string().url().nullable(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const orderStatusValueSchema = z.enum([
  "pending",
  "paid",
  "shipped",
  "delivered",
  "failed",
  "cancelled",
]);
export type OrderStatusValue = z.infer<typeof orderStatusValueSchema>;

/**
 * Server-enforced transition rules for the admin status-update endpoint.
 * "paid" is reachable only via the payment webhook (markOrderPaid), never
 * through this map / the manual admin PATCH.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  pending: ["cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  failed: [],
  cancelled: [],
};

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

// How the owner collects payment - "both" lets the buyer choose COD vs Pay
// Now at checkout (see checkoutRequestSchema.paymentMethod).
export const paymentCollectionMethodSchema = z.enum(["cod", "prepaid", "both"]);
export type PaymentCollectionMethod = z.infer<typeof paymentCollectionMethodSchema>;

export const paymentSettingsRequestSchema = z
  .object({
    collectionMethod: paymentCollectionMethodSchema,
    // Only required when collectionMethod isn't "cod" - a pure COD store
    // needs no gateway at all.
    provider: paymentProviderKeySchema.optional(),
    publicKey: z.string().trim().min(1).optional(),
    secretKey: z.string().trim().min(1).optional(),
    mode: paymentModeSchema.optional(),
    // Required (password always, code only if the user has 2FA enabled) when
    // mode is "live" - this is the re-auth bar for real money movement,
    // verified server-side. Not needed for test mode.
    password: z.string().optional(),
    code: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.collectionMethod === "cod") return;
    if (!data.provider) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provider"], message: "Required" });
    }
    if (!data.publicKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publicKey"], message: "Required" });
    }
    if (!data.secretKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["secretKey"], message: "Required" });
    }
    if (!data.mode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mode"], message: "Required" });
    }
  });
export type PaymentSettingsRequest = z.infer<typeof paymentSettingsRequestSchema>;

export const paymentSettingsResponseSchema = z.object({
  collectionMethod: paymentCollectionMethodSchema.nullable(),
  provider: paymentProviderKeySchema.nullable(),
  mode: paymentModeSchema.nullable(),
  enabled: z.boolean(),
  hasSecretKey: z.boolean(),
  publicKey: z.string().nullable(),
});
export type PaymentSettingsResponse = z.infer<typeof paymentSettingsResponseSchema>;

// ---------- whatsapp settings ----------

export const whatsappConnectRequestSchema = z.object({
  code: z.string().trim().min(1),
  wabaId: z.string().trim().min(1),
  phoneNumberId: z.string().trim().min(1),
});
export type WhatsappConnectRequest = z.infer<typeof whatsappConnectRequestSchema>;

export const whatsappSettingsResponseSchema = z.object({
  connected: z.boolean(),
  wabaId: z.string().nullable(),
  phoneNumberId: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  displayName: z.string().nullable(),
  accountStatus: z.enum(["pending", "approved", "rejected"]).nullable(),
  enabled: z.boolean(),
});
export type WhatsappSettingsResponse = z.infer<typeof whatsappSettingsResponseSchema>;

// ---------- analytics settings ----------

export const analyticsSettingsRequestSchema = z.object({
  metaPixelId: z.string().trim().min(1),
  metaCapiToken: z.string().trim().min(1),
  enabled: z.boolean(),
});
export type AnalyticsSettingsRequest = z.infer<typeof analyticsSettingsRequestSchema>;

export const analyticsSettingsResponseSchema = z.object({
  metaPixelId: z.string().nullable(),
  hasCapiToken: z.boolean(),
  enabled: z.boolean(),
});
export type AnalyticsSettingsResponse = z.infer<typeof analyticsSettingsResponseSchema>;

// ---------- orders (merchant-facing) ----------

// ---------- customers ----------

export const customerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  orderCount: z.number().int().nonnegative(),
  totalSpentCents: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;

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
  deliveryAddress: z.string().nullable(),
  deliveryCity: z.string().nullable(),
  deliveryState: z.string().nullable(),
  deliveryFeeCents: z.number().int().nonnegative(),
  vatAmountCents: z.number().int().nonnegative(),
  paymentProvider: paymentProviderKeySchema.nullable(),
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
  collectionId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().nullable(),
  currency: z.string(),
  imageUrl: z.string().nullable(),
  variants: z.array(productVariantSchema),
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
  collections: z.array(collectionSchema),
  // Public-safe subset only - never the CAPI token, which stays server-side.
  analytics: z.object({
    metaPixelId: z.string().nullable(),
  }),
  payment: z.object({
    collectionMethod: paymentCollectionMethodSchema,
  }),
});
export type PublicSite = z.infer<typeof publicSiteSchema>;
