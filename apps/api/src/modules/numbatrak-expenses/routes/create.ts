import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { createNumbatrakUnifiedExpenseRequestSchema } from "@platform/shared-types";
import { auth } from "../../../lib/auth.js";
import { createExpense } from "../lib/expenses.js";

export default async function createExpenseRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/expenses",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakUnifiedExpenseRequestSchema.parse(request.body);
      const db = app.getDb();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      const expense = await createExpense(db, request.activeOrganizationId!, session?.user.id ?? null, body);
      return reply.code(201).send(expense);
    },
  );
}
