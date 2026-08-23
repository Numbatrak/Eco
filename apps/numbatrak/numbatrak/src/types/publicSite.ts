/**
 * Mirrors the slice of @platform/shared-types/commerce.ts needed to type the
 * ported StorefrontPreview components (see src/types/siteConfig.ts for why
 * numbatrak can't import that package directly).
 */

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stockCount: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSiteProduct {
  id: string;
  collectionId: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  imageUrl: string | null;
  variants: ProductVariant[];
}
