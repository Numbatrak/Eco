import type { FastifyInstance } from "fastify";
import {
  expensesQuerySchema,
  createExpenseRequestSchema,
  updateExpenseRequestSchema,
  createExpenseSubCategoryRequestSchema,
} from "@platform/shared-types";
import {
  listExpenses,
  listSubCategories,
  createExpense,
  updateExpense,
  softDeleteExpense,
  restoreExpense,
  createSubCategory,
} from "../lib/expenses-store.js";
import { computePnl, computeAdPerformance } from "../lib/business-metrics-store.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

const DEFAULT_RANGE_DAYS = 30;

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  return { from: fromDate, to: toDate };
}

export default async function businessMetricsRoutes(app: FastifyInstance): Promise<void> {
  // --- expenses CRUD ---
  app.get("/platform-admin/business-metrics/expenses", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = expensesQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const db = app.getDb();
    const [expenseRows, subCategories] = await Promise.all([
      listExpenses(db, { from, to, category: query.category }),
      listSubCategories(db),
    ]);
    return reply.send({ expenses: expenseRows, subCategories });
  });

  app.post("/platform-admin/business-metrics/expenses", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = createExpenseRequestSchema.parse(request.body);
    const db = app.getDb();
    const expense = await createExpense(db, { ...body, adminId: request.platformAdminId! });
    await logPlatformAdminAction(db, {
      adminId: request.platformAdminId!,
      action: "expense_recorded",
      targetType: "expense",
      targetId: expense.id,
      details: { parentCategory: body.parentCategory, amountCents: body.amountCents },
    });
    return reply.code(201).send(expense);
  });

  app.patch<{ Params: { id: string } }>(
    "/platform-admin/business-metrics/expenses/:id",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = updateExpenseRequestSchema.parse(request.body);
      const db = app.getDb();
      const ok = await updateExpense(db, request.params.id, body);
      if (!ok) return reply.code(404).send({ error: "expense_not_found" });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "expense_updated",
        targetType: "expense",
        targetId: request.params.id,
        details: body,
      });
      return reply.send({ ok: true });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/platform-admin/business-metrics/expenses/:id",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const ok = await softDeleteExpense(db, request.params.id);
      if (!ok) return reply.code(404).send({ error: "expense_not_found" });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "expense_deleted",
        targetType: "expense",
        targetId: request.params.id,
        details: {},
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/platform-admin/business-metrics/expenses/:id/restore",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const ok = await restoreExpense(db, request.params.id);
      if (!ok) return reply.code(404).send({ error: "expense_not_found" });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "expense_restored",
        targetType: "expense",
        targetId: request.params.id,
        details: {},
      });
      return reply.send({ ok: true });
    },
  );

  // --- sub-categories ---
  app.post("/platform-admin/business-metrics/sub-categories", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = createExpenseSubCategoryRequestSchema.parse(request.body);
    const sub = await createSubCategory(app.getDb(), body);
    return reply.code(201).send(sub);
  });

  // --- P&L ---
  app.get("/platform-admin/business-metrics/pnl", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = expensesQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    return reply.send(await computePnl(app.getDb(), from, to));
  });

  // --- Ad performance ---
  app.get("/platform-admin/business-metrics/ad-performance", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = expensesQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    return reply.send(await computeAdPerformance(app.getDb(), from, to));
  });
}
