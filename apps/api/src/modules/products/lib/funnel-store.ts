import { eq } from "drizzle-orm";
import { productFunnelConfig, type Database } from "@platform/db";
import {
  funnelConfigSchema,
  defaultFunnelSections,
  type FunnelConfig,
  type FunnelConfigResponse,
} from "@platform/shared-types";

/**
 * Every route that reads or writes a product's funnel config calls this
 * first, so a missing row (a product created before Funnel Mode existed, or
 * one that's simply never had its funnel touched) is never a hard failure -
 * mirrors ensureTenantSiteConfig's exact role for tenant_site_config.
 */
export async function ensureProductFunnelConfig(db: Database, productId: string): Promise<void> {
  // Seed with real starter sections, not the bare column default ([]) - an
  // empty array is valid per funnelConfigSchema, so parseStoredFunnelSections
  // below would never trigger its own default-seeding fallback on it.
  await db
    .insert(productFunnelConfig)
    .values({ productId, sections: defaultFunnelSections() })
    .onConflictDoNothing();
}

function parseStoredFunnelSections(sections: unknown): FunnelConfig {
  const parsed = funnelConfigSchema.safeParse({ sections });
  return parsed.success ? parsed.data : { sections: defaultFunnelSections() };
}

export async function findFunnelConfigByProduct(
  db: Database,
  productId: string,
): Promise<FunnelConfigResponse> {
  const [row] = await db
    .select({ sections: productFunnelConfig.sections, publishedAt: productFunnelConfig.publishedAt })
    .from(productFunnelConfig)
    .where(eq(productFunnelConfig.productId, productId))
    .limit(1);
  if (!row) {
    return { sections: defaultFunnelSections(), isPublished: false };
  }
  return { ...parseStoredFunnelSections(row.sections), isPublished: row.publishedAt !== null };
}

export async function saveFunnelConfig(
  db: Database,
  productId: string,
  config: FunnelConfig,
): Promise<void> {
  await db
    .update(productFunnelConfig)
    .set({ sections: config.sections, updatedAt: new Date() })
    .where(eq(productFunnelConfig.productId, productId));
}

export async function publishFunnel(db: Database, productId: string): Promise<void> {
  await db
    .update(productFunnelConfig)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(productFunnelConfig.productId, productId));
}

export async function unpublishFunnel(db: Database, productId: string): Promise<void> {
  await db
    .update(productFunnelConfig)
    .set({ publishedAt: null, updatedAt: new Date() })
    .where(eq(productFunnelConfig.productId, productId));
}
