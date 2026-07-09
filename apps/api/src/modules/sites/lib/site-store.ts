import { and, eq, sql } from "drizzle-orm";
import { organization, tenantSiteConfig, products, type Database } from "@platform/db";
import type { PublicSite } from "@platform/shared-types";

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

/** Lighter than findPublishedSiteBySubdomain - no product list, for cart/checkout tenant resolution. */
export async function findPublishedTenantBySubdomain(
  db: Database,
  subdomain: string,
): Promise<TenantSummary | null> {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      publishedAt: tenantSiteConfig.publishedAt,
    })
    .from(organization)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, organization.id))
    .where(sql`lower(${organization.slug}) = lower(${subdomain})`)
    .limit(1);
  if (!row || !row.publishedAt) {
    return null;
  }
  return { id: row.id, name: row.name, subdomain: row.subdomain };
}

export async function findPublishedSiteBySubdomain(
  db: Database,
  subdomain: string,
): Promise<PublicSite | null> {
  const [row] = await db
    .select({
      tenantId: organization.id,
      tenantName: organization.name,
      subdomain: organization.slug,
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
    return null;
  }

  const publishedProducts = row.productsGridEnabled
    ? await db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          priceCents: products.priceCents,
          currency: products.currency,
          imageUrl: products.imageUrl,
        })
        .from(products)
        .where(and(eq(products.tenantId, row.tenantId), eq(products.status, "published")))
    : [];

  return {
    tenant: { id: row.tenantId, name: row.tenantName, subdomain: row.subdomain as string },
    theme: row.theme,
    sections: row.sections,
    productsGridEnabled: row.productsGridEnabled,
    products: publishedProducts,
  };
}
