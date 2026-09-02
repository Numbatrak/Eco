import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { member, numbatrakStaff } from "@platform/db";
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
  getPayrollLineTrace,
  type PayrollScope,
} from "../lib/payroll.js";

// Same session-refetch + member-role check as numbatrak-staff/routes/list.ts's
// scoping ("team" has no reporting hierarchy in this schema yet, so manager
// is treated as org-wide for now, mirroring that same simplification).
const BROAD_VISIBILITY_ROLES = new Set(["owner", "admin", "manager"]);

async function resolvePayrollScope(
  app: FastifyInstance,
  request: FastifyRequest,
  organizationId: string,
): Promise<PayrollScope> {
  const db = app.getDb();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return { all: false, ownUserId: "" };

  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
    .limit(1);
  if (!membership || !BROAD_VISIBILITY_ROLES.has(membership.role)) {
    return { all: false, ownUserId: session.user.id };
  }
  return { all: true };
}

export default async function numbatrakPayrollRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/payroll/structures",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const scope = await resolvePayrollScope(app, request, organizationId);
      const structures = await listPayStructures(db, organizationId, scope);
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
      const scope = await resolvePayrollScope(app, request, organizationId);
      const run = await getPayrollRun(db, organizationId, month, scope);
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
      const row = await markPaid(db, request.log, lineId, paid);
      if (!row) return reply.status(404).send({ error: "Line not found" });
      return reply.send({ ok: true });
    },
  );

  app.get(
    "/org/numbatrak/payroll/lines/:lineId/trace",
    { preHandler: app.requireOrgPermission({ numbatrakPayroll: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { lineId } = request.params as { lineId: string };
      const trace = await getPayrollLineTrace(db, lineId);
      if (!trace) return reply.status(404).send({ error: "Line not found" });

      const scope = await resolvePayrollScope(app, request, organizationId);
      if (!scope.all) {
        const [staffRow] = await db
          .select({ userId: numbatrakStaff.userId })
          .from(numbatrakStaff)
          .where(eq(numbatrakStaff.id, trace.staffId))
          .limit(1);
        if (staffRow?.userId !== scope.ownUserId) {
          return reply.status(404).send({ error: "Line not found" });
        }
      }

      return reply.send(trace);
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
