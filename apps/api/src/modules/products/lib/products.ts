import { and, eq } from "drizzle-orm";
import { products, type Database } from "@platform/db";
import type { CreateProductRequest, Product, UpdateProductRequest } from "@platform/shared-types";

export type ProductRow = typeof products.$inferSelect;

export function serializeProduct(row: ProductRow): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    imageUrl: row.imageUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProductsForTenant(db: Database, tenantId: string): Promise<ProductRow[]> {
  return db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(products.createdAt);
}

export async function findProductForTenant(
  db: Database,
  tenantId: string,
  productId: string,
): Promise<ProductRow | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);
  return row ?? null;
}

export async function createProduct(
  db: Database,
  tenantId: string,
  input: CreateProductRequest,
): Promise<ProductRow> {
  const [row] = await db
    .insert(products)
    .values({ tenantId, ...input })
    .returning();
  if (!row) {
    throw new Error("Failed to create product");
  }
  return row;
}

export async function updateProduct(
  db: Database,
  tenantId: string,
  productId: string,
  patch: UpdateProductRequest,
): Promise<ProductRow | null> {
  const [row] = await db
    .update(products)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .returning();
  return row ?? null;
}

export async function deleteProduct(
  db: Database,
  tenantId: string,
  productId: string,
): Promise<boolean> {
  const result = await db
    .delete(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .returning({ id: products.id });
  return result.length > 0;
}
