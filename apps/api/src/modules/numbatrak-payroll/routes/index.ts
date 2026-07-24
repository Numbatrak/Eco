import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  listPayStructures,
  upsertPayStructure,
  getPayrollRun,
  runPayroll,
  overrideLine,
  setManualAdjustment,
  awardSotm,
  markPaid,
  getMyEarnings,
} from "../lib/payroll.js";

export default async function numbatrakPayrollRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/payroll/structures",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const structures = await listPayStructures(db, organizationId);
      return reply.send({ structures });
    },
  );

  app.post(
    "/org/numbatrak/payroll/structures",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      const structure = await upsertPayStructure(db, organizationId, body as Parameters<typeof upsertPayStructure>[2]);
      return reply.send(structure);
    },
  );

  app.get(
    "/org/numbatrak/payroll/run/:month",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { month } = request.params as { month: string };
      const run = await getPayrollRun(db, organizationId, month);
      if (!run) return reply.status(404).send({ error: "No payroll run found for this month" });
      return reply.send(run);
    },
  );

  app.post(
    "/org/numbatrak/payroll/run",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { month } = request.body as { month: string };
      const run = await runPayroll(db, organizationId, month);
      return reply.send(run);
    },
  );

  app.patch(
    "/org/numbatrak/payroll/lines/:lineId/override",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { lineId } = request.params as { lineId: string };
      const body = request.body as { overrideBaseSalary?: number | null; overrideCommission?: number | null };
      const row = await overrideLine(db, lineId, body);
      if (!row) return reply.status(404).send({ error: "Line not found" });
      return reply.send({ ok: true });
    },
  );

  app.patch(
    "/org/numbatrak/payroll/lines/:lineId/adjustment",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { lineId } = request.params as { lineId: string };
      const body = request.body as { manualAdjustment: number; manualAdjustmentNote?: string | null };
      const row = await setManualAdjustment(db, lineId, body);
      if (!row) return reply.status(404).send({ error: "Line not found" });
      return reply.send({ ok: true });
    },
  );

  app.patch(
    "/org/numbatrak/payroll/lines/:lineId/sotm",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { lineId } = request.params as { lineId: string };
      const { sotmAwarded } = request.body as { sotmAwarded: boolean };
      const row = await awardSotm(db, lineId, sotmAwarded);
      if (!row) return reply.status(404).send({ error: "Line not found" });
      return reply.send({ ok: true });
    },
  );

  app.patch(
    "/org/numbatrak/payroll/lines/:lineId/paid",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { lineId } = request.params as { lineId: string };
      const { paid } = request.body as { paid: boolean };
      const row = await markPaid(db, lineId, paid);
      if (!row) return reply.status(404).send({ error: "Line not found" });
      return reply.send({ ok: true });
    },
  );

  app.get(
    "/org/numbatrak/payroll/my-earnings",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const earnings = await getMyEarnings(db, organizationId, session.user.id);
      if (!earnings) return reply.status(404).send({ error: "No pay structure configured" });
      return reply.send(earnings);
    },
  );
}
