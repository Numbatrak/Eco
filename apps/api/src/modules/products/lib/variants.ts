import { and, eq } from "drizzle-orm";
import { productVariants, type Database } from "@platform/db";
import type { ProductVariant, CreateVariantRequest, UpdateVariantRequest } from "@platform/shared-types";
import { isUniqueViolation } from "../../../lib/db-errors.js";
import { findProductForTenant } from "./products.js";

export type ProductVariantRow = typeof productVariants.$inferSelect;

export function serializeVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.productId,
    size: row.size,
    color: row.color,
    stockCount: row.stockCount,
    isAvailable: row.isAvailable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Returns null if the product doesn't belong to this tenant. */
export async function listVariantsForProduct(
  db: Database,
  tenantId: string,
  productId: string,
): Promise<ProductVariantRow[] | null> {
  const product = await findProductForTenant(db, tenantId, productId);
  if (!product) {
    return null;
  }
  return db.select().from(productVariants).where(eq(productVariants.productId, productId));
}

export type VariantWriteResult<T> =
  | { ok: true; variant: T }
  | { ok: false; reason: "product_not_found" | "variant_not_found" | "duplicate_variant" };

export async function createVariant(
  db: Database,
  tenantId: string,
  productId: string,
  input: CreateVariantRequest,
): Promise<VariantWriteResult<ProductVariantRow>> {
  const product = await findProductForTenant(db, tenantId, productId);
  if (!product) {
    return { ok: false, reason: "product_not_found" };
  }
  try {
    const [row] = await db.insert(productVariants).values({ productId, ...input }).returning();
    if (!row) {
      throw new Error("Failed to create variant");
    }
    return { ok: true, variant: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "duplicate_variant" };
    }
    throw err;
  }
}

export async function updateVariant(
  db: Database,
  tenantId: string,
  productId: string,
  variantId: string,
  patch: UpdateVariantRequest,
): Promise<VariantWriteResult<ProductVariantRow>> {
  const product = await findProductForTenant(db, tenantId, productId);
  if (!product) {
    return { ok: false, reason: "product_not_found" };
  }
  try {
    const [row] = await db
      .update(productVariants)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
      .returning();
    if (!row) {
      return { ok: false, reason: "variant_not_found" };
    }
    return { ok: true, variant: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "duplicate_variant" };
    }
    throw err;
  }
}

export async function deleteVariant(
  db: Database,
  tenantId: string,
  productId: string,
  variantId: string,
): Promise<boolean> {
  const product = await findProductForTenant(db, tenantId, productId);
  if (!product) {
    return false;
  }
  const result = await db
    .delete(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .returning({ id: productVariants.id });
  return result.length > 0;
}
