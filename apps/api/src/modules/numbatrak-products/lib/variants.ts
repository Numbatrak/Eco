import { and, eq } from "drizzle-orm";
import { numbatrakProductVariants, type Database } from "@platform/db";
import type { CreateNumbatrakProductVariantRequest, UpdateNumbatrakProductVariantRequest } from "@platform/shared-types";
import type { NumbatrakProductVariantRow } from "./products.js";

export async function createVariant(
  db: Database,
  organizationId: string,
  productId: string,
  input: CreateNumbatrakProductVariantRequest,
): Promise<NumbatrakProductVariantRow> {
  const [row] = await db
    .insert(numbatrakProductVariants)
    .values({
      organizationId,
      productId,
      name: input.name,
      sku: input.sku ?? null,
      basePrice: String(input.basePrice),
      costPrice: String(input.costPrice),
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error("Failed to create variant");
  return row;
}

export async function updateVariant(
  db: Database,
  organizationId: string,
  variantId: string,
  input: UpdateNumbatrakProductVariantRequest,
): Promise<NumbatrakProductVariantRow | null> {
  const values: Partial<typeof numbatrakProductVariants.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.sku !== undefined) values.sku = input.sku;
  if (input.basePrice !== undefined) values.basePrice = String(input.basePrice);
  if (input.costPrice !== undefined) values.costPrice = String(input.costPrice);
  if (input.active !== undefined) values.active = input.active;
  if (input.displayOrder !== undefined) values.displayOrder = input.displayOrder;

  const [row] = await db
    .update(numbatrakProductVariants)
    .set(values)
    .where(and(eq(numbatrakProductVariants.organizationId, organizationId), eq(numbatrakProductVariants.id, variantId)))
    .returning();
  return row ?? null;
}

export async function removeVariant(db: Database, organizationId: string, variantId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakProductVariants)
    .where(and(eq(numbatrakProductVariants.organizationId, organizationId), eq(numbatrakProductVariants.id, variantId)))
    .returning({ id: numbatrakProductVariants.id });
  return result.length > 0;
}
