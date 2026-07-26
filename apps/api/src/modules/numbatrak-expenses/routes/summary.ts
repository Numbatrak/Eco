import type { FastifyInstance } from "fastify";
import { expenseSummaryQuerySchema } from "@platform/shared-types";
import { computeExpenseSummary } from "../lib/summary.js";

export default async function expenseSummaryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/expenses/summary",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["view"] }) },
    async (request, reply) => {
      const query = expenseSummaryQuerySchema.parse(request.query);
      const db = app.getDb();
      const summary = await computeExpenseSummary(db, request.activeOrganizationId!, query);
      return reply.send(summary);
    },
  );
}
