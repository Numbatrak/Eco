import { and, eq } from "drizzle-orm";
import { products, productVariants, productFunnelConfig, type Database } from "@platform/db";
import {
  funnelConfigSchema,
  defaultFunnelSections,
  type FunnelSection,
  type FunnelPackageOption,
  type PublicFunnel,
} from "@platform/shared-types";
import type { TenantSummary } from "./site-store.js";

function parseStoredFunnelSections(sections: unknown): FunnelSection[] {
  const parsed = funnelConfigSchema.safeParse({ sections });
  return parsed.success ? parsed.data.sections : defaultFunnelSections();
}

/**
 * Public read - only returns a funnel when both the product is published
 * (the same catalog-visibility rule as everywhere else) AND the funnel
 * itself has been published (publishedAt set, "turned on" by the owner).
 * `tenant` must already be confirmed published/not-suspended by the caller
 * (findPublishedTenantBySubdomain) - this function doesn't re-check that.
 */
export async function findPublishedFunnel(
  db: Database,
  tenant: TenantSummary,
  productId: string,
): Promise<PublicFunnel | null> {
  const [row] = await db
    .select({
      productId: products.id,
      collectionId: products.collectionId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      imageUrl: products.imageUrl,
      status: products.status,
      sections: productFunnelConfig.sections,
      publishedAt: productFunnelConfig.publishedAt,
    })
    .from(products)
    .innerJoin(productFunnelConfig, eq(productFunnelConfig.productId, products.id))
    .where(and(eq(products.tenantId, tenant.id), eq(products.id, productId)))
    .limit(1);

  if (!row || !row.publishedAt || row.status !== "published") {
    return null;
  }

  const variantRows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, row.productId));

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain as string },
    product: {
      id: row.productId,
      collectionId: row.collectionId,
      name: row.name,
      description: row.description,
      priceCents: row.priceCents,
      compareAtPriceCents: row.compareAtPriceCents,
      currency: row.currency,
      imageUrl: row.imageUrl,
      variants: variantRows.map((variant) => ({
        id: variant.id,
        productId: variant.productId,
        size: variant.size,
        color: variant.color,
        stockCount: variant.stockCount,
        isAvailable: variant.isAvailable,
        createdAt: variant.createdAt.toISOString(),
        updatedAt: variant.updatedAt.toISOString(),
      })),
    },
    sections: parseStoredFunnelSections(row.sections),
  };
}

/** Server-side source of truth for a package's price/quantity - never trust
 * a client-sent price (LOCKED rule, same as delivery/cart pricing). */
export function getFunnelPackages(sections: FunnelSection[]): FunnelPackageOption[] {
  const section = sections.find((s) => s.kind === "funnel-packages");
  return section && section.kind === "funnel-packages" ? section.options : [];
}
