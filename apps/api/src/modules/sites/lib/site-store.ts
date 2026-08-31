import { and, eq, inArray, sql } from "drizzle-orm";
import {
  organization,
  tenantSiteConfig,
  products,
  productVariants,
  collections,
  tenantAnalyticsSettings,
  tenantPaymentSettings,
  type Database,
} from "@platform/db";
import {
  defaultSiteConfig,
  siteConfigSchema,
  type PublicSite,
  type SiteConfig,
} from "@platform/shared-types";

/**
 * Fresh tenants (or rows written before the typed schema landed) may have
 * empty `{}` / `[]` JSONB. Parse-with-fallback so the builder always renders
 * a working default rather than crashing on a legacy row.
 */
function parseStoredSiteConfig(theme: unknown, sections: unknown): SiteConfig {
  const parsed = siteConfigSchema.safeParse({ theme, sections });
  return parsed.success ? parsed.data : defaultSiteConfig("market");
}

/**
 * `/auth/register` provisions this row for every newly-created org (see its
 * comment), but numbatrak orgs can also arrive without one - accounts
 * created before that provisioning line shipped, or through any other
 * org-creation path. Every route that reads or writes tenant_site_config
 * calls this first so a missing row is never a hard failure (a 404 on the
 * inner-joined GET, or a silent no-op on the UPDATE-only writes).
 */
export async function ensureTenantSiteConfig(db: Database, tenantId: string): Promise<void> {
  await db.insert(tenantSiteConfig).values({ tenantId }).onConflictDoNothing();
}

export interface TenantSummary {
  id: string;
  name: string;
  subdomain: string | null;
}

export interface TenantSettings {
  id: string;
  name: string;
  subdomain: string | null;
  published: boolean;
  showProductGrid: boolean;
}

export async function findTenantSettings(
  db: Database,
  tenantId: string,
): Promise<TenantSettings | null> {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      publishedAt: tenantSiteConfig.publishedAt,
      productsGridEnabled: tenantSiteConfig.productsGridEnabled,
    })
    .from(organization)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, organization.id))
    .where(eq(organization.id, tenantId))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    published: Boolean(row.publishedAt),
    showProductGrid: row.productsGridEnabled,
  };
}

export async function findTenantBySubdomain(
  db: Database,
  subdomain: string,
): Promise<TenantSummary | null> {
  const [row] = await db
    .select({ id: organization.id, name: organization.name, subdomain: organization.slug })
    .from(organization)
    .where(sql`lower(${organization.slug}) = lower(${subdomain})`)
    .limit(1);
  return row ?? null;
}

/**
 * Lighter than findPublishedSiteBySubdomain - no product list, for
 * cart/checkout tenant resolution. Suspended tenants are excluded outright
 * (cart/checkout aren't the endpoint the spec calls out for a distinct
 * "unavailable" message - they just fail closed, same as "no such site").
 */
export async function findPublishedTenantBySubdomain(
  db: Database,
  subdomain: string,
): Promise<TenantSummary | null> {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      status: organization.status,
      publishedAt: tenantSiteConfig.publishedAt,
    })
    .from(organization)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, organization.id))
    .where(sql`lower(${organization.slug}) = lower(${subdomain})`)
    .limit(1);
  if (!row || !row.publishedAt || row.status === "suspended") {
    return null;
  }
  return { id: row.id, name: row.name, subdomain: row.subdomain };
}

export type PublicSiteLookupResult =
  | { kind: "not_found" }
  | { kind: "suspended" }
  | { kind: "ok"; site: PublicSite };

export async function findPublishedSiteBySubdomain(
  db: Database,
  subdomain: string,
): Promise<PublicSiteLookupResult> {
  const [row] = await db
    .select({
      tenantId: organization.id,
      tenantName: organization.name,
      subdomain: organization.slug,
      status: organization.status,
      theme: tenantSiteConfig.theme,
      sections: tenantSiteConfig.sections,
      productsGridEnabled: tenantSiteConfig.productsGridEnabled,
      publishedAt: tenantSiteConfig.publishedAt,
    })
    .from(organization)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, organization.id))
    .where(sql`lower(${organization.slug}) = lower(${subdomain})`)
    .limit(1);

  if (!row || !row.publishedAt) {
    return { kind: "not_found" };
  }
  if (row.status === "suspended") {
    return { kind: "suspended" };
  }

  // Fetched unconditionally - productsGridEnabled only gates whether the
  // homepage's ProductsSection renders this list, not whether the
  // /collections and /products/:id catalog pages have data to show.
  const publishedProducts = await db
    .select({
      id: products.id,
      collectionId: products.collectionId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .where(and(eq(products.tenantId, row.tenantId), eq(products.status, "published")));

  const productIds = publishedProducts.map((product) => product.id);
  const variantRows =
    productIds.length > 0
      ? await db.select().from(productVariants).where(inArray(productVariants.productId, productIds))
      : [];
  const variantsByProductId = new Map<string, typeof variantRows>();
  for (const variant of variantRows) {
    const existing = variantsByProductId.get(variant.productId) ?? [];
    existing.push(variant);
    variantsByProductId.set(variant.productId, existing);
  }

  const activeCollections = await db
    .select()
    .from(collections)
    .where(and(eq(collections.tenantId, row.tenantId), eq(collections.isActive, true)))
    .orderBy(collections.sortOrder);

  const [analyticsSettings] = await db
    .select({ metaPixelId: tenantAnalyticsSettings.metaPixelId, enabled: tenantAnalyticsSettings.enabled })
    .from(tenantAnalyticsSettings)
    .where(eq(tenantAnalyticsSettings.tenantId, row.tenantId))
    .limit(1);

  const [paymentSettings] = await db
    .select({ collectionMethod: tenantPaymentSettings.collectionMethod })
    .from(tenantPaymentSettings)
    .where(eq(tenantPaymentSettings.tenantId, row.tenantId))
    .limit(1);

  const config = parseStoredSiteConfig(row.theme, row.sections);

  return {
    kind: "ok",
    site: {
      tenant: { id: row.tenantId, name: row.tenantName, subdomain: row.subdomain as string },
      theme: config.theme,
      sections: config.sections,
      productsGridEnabled: row.productsGridEnabled,
      products: publishedProducts.map((product) => ({
        ...product,
        variants: (variantsByProductId.get(product.id) ?? []).map((variant) => ({
          id: variant.id,
          productId: variant.productId,
          size: variant.size,
          color: variant.color,
          stockCount: variant.stockCount,
          isAvailable: variant.isAvailable,
          createdAt: variant.createdAt.toISOString(),
          updatedAt: variant.updatedAt.toISOString(),
        })),
      })),
      collections: activeCollections.map((collection) => ({
        id: collection.id,
        tenantId: collection.tenantId,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        imageUrl: collection.imageUrl,
        sortOrder: collection.sortOrder,
        isActive: collection.isActive,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      })),
      analytics: {
        metaPixelId: analyticsSettings?.enabled ? analyticsSettings.metaPixelId : null,
      },
      // No row at all = never touched payments - same "cod" default checkout.ts
      // applies when settings are missing, so this stays consistent.
      payment: {
        collectionMethod: paymentSettings?.collectionMethod ?? "cod",
      },
    },
  };
}

export async function findSiteConfigByTenant(
  db: Database,
  tenantId: string,
): Promise<SiteConfig> {
  const [row] = await db
    .select({
      theme: tenantSiteConfig.theme,
      sections: tenantSiteConfig.sections,
    })
    .from(tenantSiteConfig)
    .where(eq(tenantSiteConfig.tenantId, tenantId))
    .limit(1);
  if (!row) {
    return defaultSiteConfig("market");
  }
  return parseStoredSiteConfig(row.theme, row.sections);
}

export async function saveSiteConfig(
  db: Database,
  tenantId: string,
  config: SiteConfig,
): Promise<void> {
  // Keep the legacy `productsGridEnabled` column in sync with the presence
  // of a visible products section so the existing /public/sites reader can
  // continue to gate the product-list join on it without a migration.
  const productsGridEnabled = config.sections.some(
    (section) => section.kind === "products" && section.visible,
  );
  await db
    .update(tenantSiteConfig)
    .set({
      theme: config.theme,
      sections: config.sections,
      productsGridEnabled,
      updatedAt: new Date(),
    })
    .where(eq(tenantSiteConfig.tenantId, tenantId));
}

export async function publishSite(db: Database, tenantId: string): Promise<{ slug: string | null }> {
  await db
    .update(tenantSiteConfig)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenantSiteConfig.tenantId, tenantId));
  const [org] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, tenantId))
    .limit(1);
  return { slug: org?.slug ?? null };
}
