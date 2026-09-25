import { z } from "zod";

/**
 * Split out of commerce.ts so both commerce.ts and funnel-config.ts can
 * depend on this without creating a commerce.ts <-> funnel-config.ts import
 * cycle (funnel-config.ts's publicFunnelSchema needs the product shape;
 * commerce.ts's publicSiteSchema needs funnel-config.ts's publicFunnelSchema
 * for its `funnel` field). Keep this file leaf-level - it should not import
 * from commerce.ts or funnel-config.ts.
 */

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
