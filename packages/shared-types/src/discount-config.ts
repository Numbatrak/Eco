import { z } from "zod";

const valueTypeSchema = z.enum(["percentage", "fixed_amount"]);

export const amountOffProductsConfigSchema = z.object({
  type: z.literal("amount_off_products"),
  valueType: valueTypeSchema,
  value: z.number().positive(),
  targetProductIds: z.array(z.string().uuid()).default([]),
  targetCollectionIds: z.array(z.string().uuid()).default([]),
});

export const buyXGetYConfigSchema = z.object({
  type: z.literal("buy_x_get_y"),
  buyProductId: z.string().uuid(),
  buyQuantity: z.number().int().positive(),
  getProductId: z.string().uuid(),
  getQuantity: z.number().int().positive(),
  // 100 = the "get" item is free; anything less is a partial discount on it.
  getDiscountPercent: z.number().int().min(1).max(100),
});

export const amountOffOrderConfigSchema = z.object({
  type: z.literal("amount_off_order"),
  valueType: valueTypeSchema,
  value: z.number().positive(),
  minimumSubtotalCents: z.number().int().nonnegative().optional(),
});

export const freeShippingConfigSchema = z.object({
  type: z.literal("free_shipping"),
  minimumSubtotalCents: z.number().int().nonnegative().optional(),
});

export const discountConfigSchema = z.discriminatedUnion("type", [
  amountOffProductsConfigSchema,
  buyXGetYConfigSchema,
  amountOffOrderConfigSchema,
  freeShippingConfigSchema,
]);
export type DiscountConfig = z.infer<typeof discountConfigSchema>;
export type DiscountType = DiscountConfig["type"];

export const discountRequestSchema = z.object({
  // Null/omitted = an automatic discount (no code needed at checkout).
  code: z.string().trim().min(1).max(64).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  active: z.boolean().optional(),
  config: discountConfigSchema,
});
export type DiscountRequest = z.infer<typeof discountRequestSchema>;

export const discountResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  code: z.string().nullable(),
  title: z.string(),
  active: z.boolean(),
  config: discountConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DiscountResponse = z.infer<typeof discountResponseSchema>;

// Resolved server-side from the buyer's cart cookie, not client-sent totals -
// same "never trust the browser" pattern as the delivery-quote preview.
export const discountCodePreviewRequestSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
export type DiscountCodePreviewRequest = z.infer<typeof discountCodePreviewRequestSchema>;

export const discountCodePreviewResponseSchema = z.object({
  valid: z.boolean(),
  amountCents: z.number().int().nonnegative(),
  freeShipping: z.boolean(),
  message: z.string().nullable(),
});
export type DiscountCodePreviewResponse = z.infer<typeof discountCodePreviewResponseSchema>;
