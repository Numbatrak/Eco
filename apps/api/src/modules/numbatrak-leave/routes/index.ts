import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  getOrCreateSettings,
  updateSettings,
  listBalances,
  listRequests,
  createRequest,
  decideRequest,
  getStaffIdForUser,
} from "../lib/leave.js";

export default async function numbatrakLeaveRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/leave/settings",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/leave/settings",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      const settings = await updateSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );

  app.get(
    "/org/numbatrak/leave/balances",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { year } = request.query as { year?: string };
      const y = year ? parseInt(year, 10) : new Date().getFullYear();
      const balances = await listBalances(db, organizationId, y);
      return reply.send({ balances });
    },
  );

  app.get(
    "/org/numbatrak/leave/requests",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { status, staffId } = request.query as { status?: string; staffId?: string };
      const requests = await listRequests(db, organizationId, status, staffId);
      return reply.send({ requests });
    },
  );

  app.post(
    "/org/numbatrak/leave/requests",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const body = request.body as { staffId?: string; leaveType: string; startDate: string; endDate: string; days: number; reason?: string | null };
      let staffId = body.staffId;
      if (!staffId) {
        staffId = await getStaffIdForUser(db, organizationId, session.user.id) ?? undefined;
      }
      if (!staffId) return reply.status(400).send({ error: "No staff record found" });

      const leaveRequest = await createRequest(db, organizationId, staffId, body);
      return reply.status(201).send(leaveRequest);
    },
  );

  app.patch(
    "/org/numbatrak/leave/requests/:requestId",
    { preHandler: app.requireOrgPermission({ numbatrakLeave: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const { requestId } = request.params as { requestId: string };
      const { status, decisionNote } = request.body as { status: "approved" | "declined"; decisionNote?: string | null };
      const result = await decideRequest(db, organizationId, requestId, status, session.user.id, decisionNote);
      if (!result) return reply.status(404).send({ error: "Request not found or already decided" });
      return reply.send(result);
    },
  );
}
