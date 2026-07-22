import type { FastifyInstance } from "fastify";
import { updateNumbatrakUnifiedExpenseRequestSchema } from "@platform/shared-types";
import { updateExpense } from "../lib/expenses.js";

export default async function updateExpenseRoutes(app: FastifyInstance): Promise<void> {
  app.patch<{ Params: { expenseId: string } }>(
    "/org/numbatrak/expenses/:expenseId",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["update"] }) },
    async (request, reply) => {
      const body = updateNumbatrakUnifiedExpenseRequestSchema.parse(request.body);
      const db = app.getDb();
      const expense = await updateExpense(db, request.activeOrganizationId!, request.params.expenseId, body);
      if (!expense) {
        return reply.code(404).send({ error: "Expense not found" });
      }
      return reply.send(expense);
    },
  );
}
