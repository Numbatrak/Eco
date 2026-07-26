import type { FastifyInstance } from "fastify";
import listExpensesRoutes from "./list.js";
import createExpenseRoutes from "./create.js";
import updateExpenseRoutes from "./update.js";
import deleteExpenseRoutes from "./delete.js";
import expenseSubcategoryRoutes from "./subcategories.js";
import expenseSummaryRoutes from "./summary.js";

export default async function numbatrakExpensesRoutes(app: FastifyInstance): Promise<void> {
  await app.register(listExpensesRoutes);
  await app.register(createExpenseRoutes);
  await app.register(updateExpenseRoutes);
  await app.register(deleteExpenseRoutes);
  await app.register(expenseSubcategoryRoutes);
  await app.register(expenseSummaryRoutes);
}
