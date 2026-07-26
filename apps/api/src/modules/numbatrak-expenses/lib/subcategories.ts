import { asc, and, eq } from "drizzle-orm";
import { numbatrakExpenseSubcategories, type Database } from "@platform/db";
import type { CreateNumbatrakExpenseSubcategoryRequest, NumbatrakExpenseSubcategory } from "@platform/shared-types";

export type ExpenseSubcategoryRow = typeof numbatrakExpenseSubcategories.$inferSelect;

export function serializeSubcategory(row: ExpenseSubcategoryRow): NumbatrakExpenseSubcategory {
  return {
    id: row.id,
    parentCategory: row.parentCategory,
    slug: row.slug,
    label: row.label,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function listSubcategoriesForOrg(db: Database, organizationId: string): Promise<ExpenseSubcategoryRow[]> {
  return db
    .select()
    .from(numbatrakExpenseSubcategories)
    .where(eq(numbatrakExpenseSubcategories.organizationId, organizationId))
    .orderBy(asc(numbatrakExpenseSubcategories.label));
}

export async function createSubcategory(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakExpenseSubcategoryRequest,
): Promise<ExpenseSubcategoryRow> {
  const [row] = await db
    .insert(numbatrakExpenseSubcategories)
    .values({
      organizationId,
      parentCategory: input.parentCategory,
      slug: input.slug,
      label: input.label,
    })
    .returning();
  if (!row) throw new Error("Failed to create subcategory");
  return row;
}

export async function removeSubcategory(db: Database, organizationId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakExpenseSubcategories)
    .where(and(eq(numbatrakExpenseSubcategories.organizationId, organizationId), eq(numbatrakExpenseSubcategories.id, id)))
    .returning({ id: numbatrakExpenseSubcategories.id });
  return result.length > 0;
}
