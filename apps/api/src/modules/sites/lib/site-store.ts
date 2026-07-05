import { and, eq, sql } from "drizzle-orm";
import { tenants, tenantSiteConfig, products, type Database } from "@platform/db";

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
}

export interface PublicSite {
  tenant: { id: string; name: string; subdomain: string };
  theme: unknown;
  sections: unknown;
  products: PublicProduct[];
}

export interface TenantSummary {
  id: string;
  name: string;
  subdomain: string | null;
}

export async function findTenantBySubdomain(
  db: Database,
  subdomain: string,
): Promise<TenantSummary | null> {
  const [row] = await db
    .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain })
    .from(tenants)
    .where(sql`lower(${tenants.subdomain}) = lower(${subdomain})`)
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
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      publishedAt: tenantSiteConfig.publishedAt,
    })
    .from(tenants)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, tenants.id))
    .where(sql`lower(${tenants.subdomain}) = lower(${subdomain})`)
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
      tenantId: tenants.id,
      tenantName: tenants.name,
      subdomain: tenants.subdomain,
      theme: tenantSiteConfig.theme,
      sections: tenantSiteConfig.sections,
      publishedAt: tenantSiteConfig.publishedAt,
    })
    .from(tenants)
    .innerJoin(tenantSiteConfig, eq(tenantSiteConfig.tenantId, tenants.id))
    .where(sql`lower(${tenants.subdomain}) = lower(${subdomain})`)
    .limit(1);

  if (!row || !row.publishedAt) {
    return null;
  }

  const publishedProducts = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      currency: products.currency,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .where(and(eq(products.tenantId, row.tenantId), eq(products.status, "published")));

  return {
    tenant: { id: row.tenantId, name: row.tenantName, subdomain: row.subdomain as string },
    theme: row.theme,
    sections: row.sections,
    products: publishedProducts,
  };
}
