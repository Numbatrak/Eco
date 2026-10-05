import type { FastifyInstance } from "fastify";
import { exportAccountingCsv, getAccountingReport, listSubBrands } from "../lib/accounting.js";

export default async function numbatrakAccountingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/accounting",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { dateFrom, dateTo, subBrand } = request.query as {
        dateFrom?: string;
        dateTo?: string;
        subBrand?: string;
      };
      const report = await getAccountingReport(db, organizationId, { dateFrom, dateTo, subBrand });
      return reply.send(report);
    },
  );

  app.get(
    "/org/numbatrak/accounting/sub-brands",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const subBrands = await listSubBrands(db, organizationId);
      return reply.send({ subBrands });
    },
  );

  app.get(
    "/org/numbatrak/accounting/export",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { dateFrom, dateTo, subBrand } = request.query as {
        dateFrom?: string;
        dateTo?: string;
        subBrand?: string;
      };
      const csv = await exportAccountingCsv(db, organizationId, { dateFrom, dateTo, subBrand });
      return reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="accounting-export.csv"`)
        .send(csv);
    },
  );
}
