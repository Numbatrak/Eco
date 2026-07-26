import { and, desc, eq, inArray } from "drizzle-orm";
import { numbatrakAgents, numbatrakProducts, numbatrakUnifiedExpenses, type Database } from "@platform/db";
import type {
  CreateNumbatrakUnifiedExpenseRequest,
  ListNumbatrakUnifiedExpensesQuery,
  NumbatrakUnifiedExpense,
  UpdateNumbatrakUnifiedExpenseRequest,
} from "@platform/shared-types";

export type ExpenseRow = typeof numbatrakUnifiedExpenses.$inferSelect;

async function attachRelations(db: Database, rows: ExpenseRow[]): Promise<NumbatrakUnifiedExpense[]> {
  if (rows.length === 0) return [];

  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const agentNames = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentNames.set(a.id, a.name);
  }

  const productIds = [...new Set(rows.map((r) => r.productId).filter((id): id is string => id != null))];
  const productNames = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    for (const p of products) productNames.set(p.id, p.name);
  }

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope as NumbatrakUnifiedExpense["scope"],
    category: row.category,
    subcategory: row.subcategory ?? "",
    amount: Number(row.amount),
    agentId: row.agentId,
    agentName: row.agentId != null ? (agentNames.get(row.agentId) ?? null) : null,
    productId: row.productId,
    productName: row.productId != null ? (productNames.get(row.productId) ?? null) : null,
    orderId: row.orderId,
    note: row.note,
    occurredAt: row.occurredAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    sourceType: row.sourceType as NumbatrakUnifiedExpense["sourceType"],
    sourceId: row.sourceId,
    offerName: row.offerName,
    platform: row.platform,
  }));
}

export async function listExpensesForOrg(
  db: Database,
  organizationId: string,
  filters: ListNumbatrakUnifiedExpensesQuery,
): Promise<NumbatrakUnifiedExpense[]> {
  const conditions = [eq(numbatrakUnifiedExpenses.organizationId, organizationId)];
  if (filters.scope) conditions.push(eq(numbatrakUnifiedExpenses.scope, filters.scope));
  if (filters.category) conditions.push(eq(numbatrakUnifiedExpenses.category, filters.category));

  const rows = await db
    .select()
    .from(numbatrakUnifiedExpenses)
    .where(and(...conditions))
    .orderBy(desc(numbatrakUnifiedExpenses.occurredAt), desc(numbatrakUnifiedExpenses.createdAt));

  return attachRelations(db, rows);
}

export async function createExpense(
  db: Database,
  organizationId: string,
  createdBy: string | null,
  input: CreateNumbatrakUnifiedExpenseRequest,
): Promise<NumbatrakUnifiedExpense> {
  const [row] = await db
    .insert(numbatrakUnifiedExpenses)
    .values({
      organizationId,
      scope: input.scope,
      category: input.category,
      subcategory: input.subcategory ?? "",
      amount: String(input.amount),
      agentId: input.agentId ?? null,
      productId: input.productId ?? null,
      orderId: input.orderId ?? null,
      note: input.note ?? null,
      occurredAt: input.occurredAt,
      createdBy,
      offerName: input.offerName?.trim() || null,
      platform: input.platform ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create expense");
  const [full] = await attachRelations(db, [row]);
  return full!;
}

export async function updateExpense(
  db: Database,
  organizationId: string,
  expenseId: string,
  input: UpdateNumbatrakUnifiedExpenseRequest,
): Promise<NumbatrakUnifiedExpense | null> {
  const values: Partial<typeof numbatrakUnifiedExpenses.$inferInsert> = {};
  if (input.scope !== undefined) values.scope = input.scope;
  if (input.category !== undefined) values.category = input.category;
  if (input.subcategory !== undefined) values.subcategory = input.subcategory;
  if (input.amount !== undefined) values.amount = String(input.amount);
  if (input.agentId !== undefined) values.agentId = input.agentId;
  if (input.productId !== undefined) values.productId = input.productId;
  if (input.orderId !== undefined) values.orderId = input.orderId;
  if (input.note !== undefined) values.note = input.note;
  if (input.occurredAt !== undefined) values.occurredAt = input.occurredAt;
  if (input.offerName !== undefined) values.offerName = input.offerName?.trim() || null;
  if (input.platform !== undefined) values.platform = input.platform;

  const [row] = await db
    .update(numbatrakUnifiedExpenses)
    .set(values)
    .where(and(eq(numbatrakUnifiedExpenses.organizationId, organizationId), eq(numbatrakUnifiedExpenses.id, expenseId)))
    .returning();
  if (!row) return null;
  const [full] = await attachRelations(db, [row]);
  return full!;
}

export async function removeExpense(db: Database, organizationId: string, expenseId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakUnifiedExpenses)
    .where(and(eq(numbatrakUnifiedExpenses.organizationId, organizationId), eq(numbatrakUnifiedExpenses.id, expenseId)))
    .returning({ id: numbatrakUnifiedExpenses.id });
  return result.length > 0;
}
