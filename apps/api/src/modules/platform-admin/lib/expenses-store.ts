import { and, eq, gte, lte, isNull, desc, sql } from "drizzle-orm";
import {
  expenses,
  expenseSubCategories,
  type Database,
} from "@platform/db";
import type {
  Expense,
  ExpenseSubCategory,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from "@platform/shared-types";

// ---------- sub-categories ----------

export async function listSubCategories(db: Database): Promise<ExpenseSubCategory[]> {
  const rows = await db
    .select()
    .from(expenseSubCategories)
    .orderBy(expenseSubCategories.parentCategory, expenseSubCategories.name);
  return rows.map((r) => ({
    id: r.id,
    parentCategory: r.parentCategory,
    name: r.name,
  }));
}

export async function createSubCategory(
  db: Database,
  params: { parentCategory: string; name: string },
): Promise<ExpenseSubCategory> {
  const [row] = await db
    .insert(expenseSubCategories)
    .values({ parentCategory: params.parentCategory as any, name: params.name })
    .returning();
  return { id: row!.id, parentCategory: row!.parentCategory, name: row!.name };
}

// ---------- expenses ----------

function serializeExpense(row: any): Expense {
  return {
    id: row.id,
    parentCategory: row.parentCategory,
    subCategoryId: row.subCategoryId ?? null,
    subCategoryName: row.subCategoryName ?? null,
    description: row.description,
    amountCents: row.amountCents,
    occurredAt: (row.occurredAt as Date).toISOString(),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function listExpenses(
  db: Database,
  opts: { from?: Date; to?: Date; category?: string },
): Promise<Expense[]> {
  const conditions = [isNull(expenses.deletedAt)];
  if (opts.from) conditions.push(gte(expenses.occurredAt, opts.from));
  if (opts.to) conditions.push(lte(expenses.occurredAt, opts.to));
  if (opts.category) conditions.push(eq(expenses.parentCategory, opts.category as any));

  const rows = await db
    .select({
      id: expenses.id,
      parentCategory: expenses.parentCategory,
      subCategoryId: expenses.subCategoryId,
      subCategoryName: expenseSubCategories.name,
      description: expenses.description,
      amountCents: expenses.amountCents,
      occurredAt: expenses.occurredAt,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(expenseSubCategories, eq(expenses.subCategoryId, expenseSubCategories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.occurredAt));

  return rows.map(serializeExpense);
}

export async function createExpense(
  db: Database,
  params: CreateExpenseRequest & { adminId: string },
): Promise<Expense> {
  const [row] = await db
    .insert(expenses)
    .values({
      parentCategory: params.parentCategory as any,
      subCategoryId: params.subCategoryId ?? null,
      description: params.description,
      amountCents: params.amountCents,
      occurredAt: new Date(params.occurredAt),
      recordedByAdminId: params.adminId,
    })
    .returning();

  return serializeExpense({ ...row!, subCategoryName: null });
}

export async function updateExpense(
  db: Database,
  id: string,
  params: UpdateExpenseRequest,
): Promise<boolean> {
  const set: Record<string, any> = { updatedAt: new Date() };
  if (params.parentCategory !== undefined) set.parentCategory = params.parentCategory;
  if (params.subCategoryId !== undefined) set.subCategoryId = params.subCategoryId;
  if (params.description !== undefined) set.description = params.description;
  if (params.amountCents !== undefined) set.amountCents = params.amountCents;
  if (params.occurredAt !== undefined) set.occurredAt = new Date(params.occurredAt);

  const result = await db
    .update(expenses)
    .set(set)
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)));
  return (result as any).rowCount > 0;
}

export async function softDeleteExpense(db: Database, id: string): Promise<boolean> {
  const result = await db
    .update(expenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)));
  return (result as any).rowCount > 0;
}

export async function restoreExpense(db: Database, id: string): Promise<boolean> {
  const result = await db
    .update(expenses)
    .set({ deletedAt: null })
    .where(eq(expenses.id, id));
  return (result as any).rowCount > 0;
}

// ---------- aggregates for P&L ----------

export async function sumExpensesByCategory(
  db: Database,
  from: Date,
  to: Date,
): Promise<{ parentCategory: string; totalCents: number }[]> {
  const rows = await db
    .select({
      parentCategory: expenses.parentCategory,
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
    })
    .from(expenses)
    .where(
      and(
        isNull(expenses.deletedAt),
        gte(expenses.occurredAt, from),
        lte(expenses.occurredAt, to),
      ),
    )
    .groupBy(expenses.parentCategory);
  return rows;
}

export async function totalAdvertisingSpend(
  db: Database,
  from: Date,
  to: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
    })
    .from(expenses)
    .where(
      and(
        isNull(expenses.deletedAt),
        eq(expenses.parentCategory, "advertising"),
        gte(expenses.occurredAt, from),
        lte(expenses.occurredAt, to),
      ),
    );
  return row?.total ?? 0;
}
