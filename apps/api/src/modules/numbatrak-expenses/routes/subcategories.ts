import type { FastifyInstance } from "fastify";
import { createNumbatrakExpenseSubcategoryRequestSchema } from "@platform/shared-types";
import { createSubcategory, listSubcategoriesForOrg, removeSubcategory, serializeSubcategory } from "../lib/subcategories.js";

export default async function expenseSubcategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/expense-subcategories",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listSubcategoriesForOrg(db, request.activeOrganizationId!);
      return reply.send({ subcategories: rows.map(serializeSubcategory) });
    },
  );

  app.post(
    "/org/numbatrak/expense-subcategories",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["create"] }) },
    async (request, reply) => {
      const body = createNumbatrakExpenseSubcategoryRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createSubcategory(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeSubcategory(row));
    },
  );

  app.delete<{ Params: { subcategoryId: string } }>(
    "/org/numbatrak/expense-subcategories/:subcategoryId",
    { preHandler: app.requireOrgPermission({ numbatrakExpenses: ["delete"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await removeSubcategory(db, request.activeOrganizationId!, request.params.subcategoryId);
      if (!deleted) {
        return reply.code(404).send({ error: "Subcategory not found" });
      }
      return reply.code(204).send();
    },
  );
}
