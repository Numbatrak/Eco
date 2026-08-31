import { and, eq } from "drizzle-orm";
import { discounts, type Database } from "@platform/db";
import type { DiscountConfig, DiscountRequest, DiscountResponse } from "@platform/shared-types";

export type DiscountRow = typeof discounts.$inferSelect;

export function serializeDiscount(row: DiscountRow): DiscountResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    title: row.title,
    active: row.active,
    config: row.config as DiscountConfig,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDiscounts(db: Database, tenantId: string): Promise<DiscountRow[]> {
  return db.select().from(discounts).where(eq(discounts.tenantId, tenantId)).orderBy(discounts.createdAt);
}

export async function getDiscount(db: Database, tenantId: string, discountId: string): Promise<DiscountRow | null> {
  const [row] = await db
    .select()
    .from(discounts)
    .where(and(eq(discounts.tenantId, tenantId), eq(discounts.id, discountId)))
    .limit(1);
  return row ?? null;
}

export async function createDiscount(db: Database, tenantId: string, input: DiscountRequest): Promise<DiscountRow> {
  const [row] = await db
    .insert(discounts)
    .values({
      tenantId,
      code: input.code ? input.code.trim().toUpperCase() : null,
      title: input.title,
      active: input.active ?? true,
      config: input.config,
    })
    .returning();
  if (!row) throw new Error("Failed to create discount");
  return row;
}

export async function updateDiscount(
  db: Database,
  tenantId: string,
  discountId: string,
  input: Partial<DiscountRequest>,
): Promise<DiscountRow | null> {
  const values: Partial<typeof discounts.$inferInsert> = { updatedAt: new Date() };
  if (input.code !== undefined) values.code = input.code ? input.code.trim().toUpperCase() : null;
  if (input.title !== undefined) values.title = input.title;
  if (input.active !== undefined) values.active = input.active;
  if (input.config !== undefined) values.config = input.config;

  const [row] = await db
    .update(discounts)
    .set(values)
    .where(and(eq(discounts.tenantId, tenantId), eq(discounts.id, discountId)))
    .returning();
  return row ?? null;
}

export async function deleteDiscount(db: Database, tenantId: string, discountId: string): Promise<boolean> {
  const result = await db
    .delete(discounts)
    .where(and(eq(discounts.tenantId, tenantId), eq(discounts.id, discountId)))
    .returning({ id: discounts.id });
  return result.length > 0;
}

/** Uppercase-normalized lookup, matching how codes are stored (see createDiscount/updateDiscount). */
export async function findActiveByCode(db: Database, tenantId: string, code: string): Promise<DiscountRow | null> {
  const [row] = await db
    .select()
    .from(discounts)
    .where(and(eq(discounts.tenantId, tenantId), eq(discounts.code, code.trim().toUpperCase()), eq(discounts.active, true)))
    .limit(1);
  return row ?? null;
}

/** Automatic discounts (no code) - checkout applies the first eligible one when no code is entered. */
export async function listActiveAutomatic(db: Database, tenantId: string): Promise<DiscountRow[]> {
  const rows = await db
    .select()
    .from(discounts)
    .where(and(eq(discounts.tenantId, tenantId), eq(discounts.active, true)))
    .orderBy(discounts.createdAt);
  return rows.filter((row) => row.code === null);
}
