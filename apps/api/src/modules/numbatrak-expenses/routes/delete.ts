import type { FastifyInstance } from "fastify";
import { removeExpense } from "../lib/expenses.js";

export default async function deleteExpenseRoutes(app: FastifyInstance): Promise<void> {
  app.delete<{ Params: { expenseId: string } }>(
    "/org/numbatrak/expenses/:expenseId",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeExpense(db, request.activeOrganizationId!, request.params.expenseId);
      if (!deleted) {
        return reply.code(404).send({ error: "Expense not found" });
      }
      return reply.code(204).send();
    },
  );
}
