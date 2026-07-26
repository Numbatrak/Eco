import type { FastifyInstance } from "fastify";
import { listNumbatrakUnifiedExpensesQuerySchema } from "@platform/shared-types";
import { listExpensesForOrg } from "../lib/expenses.js";

export default async function listExpensesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/expenses",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakUnifiedExpensesQuerySchema.parse(request.query);
      const db = app.getDb();
      const expenses = await listExpensesForOrg(db, request.activeOrganizationId!, query);
      return reply.send({ expenses });
    },
  );
}
