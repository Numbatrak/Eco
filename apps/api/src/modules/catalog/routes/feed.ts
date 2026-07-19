import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { products, productVariants } from "@platform/db";
import { findPublishedTenantBySubdomain } from "../../sites/lib/site-store.js";
import { buildCatalogFeedXml, type CatalogFeedProduct } from "../lib/build-feed.js";

export default async function catalogFeedRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/catalog.xml",
    async (request, reply) => {
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }

      const productRows = await db
        .select()
        .from(products)
        .where(and(eq(products.tenantId, tenant.id), eq(products.status, "published")));

      const productIds = productRows.map((row) => row.id);
      const variantRows =
        productIds.length > 0
          ? await db.select().from(productVariants).where(inArray(productVariants.productId, productIds))
          : [];
      const inStockByProduct = new Map<string, boolean>();
      for (const row of productRows) {
        const variants = variantRows.filter((variant) => variant.productId === row.id);
        const inStock =
          variants.length === 0 || variants.some((variant) => variant.isAvailable && variant.stockCount > 0);
        inStockByProduct.set(row.id, inStock);
      }

      const feedProducts: CatalogFeedProduct[] = productRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        priceCents: row.priceCents,
        currency: row.currency,
        imageUrl: row.imageUrl,
        inStock: inStockByProduct.get(row.id) ?? true,
      }));

      const xml = buildCatalogFeedXml(tenant.name, request.params.subdomain, feedProducts);
      return reply.header("content-type", "application/xml; charset=utf-8").send(xml);
    },
  );
}
