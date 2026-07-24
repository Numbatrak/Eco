import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  getOrCreateSettings,
  updateSettings,
  listEvents,
  createEvent,
  getEventDetail,
  markAttendance,
  exemptStaff,
  closeEvent,
} from "../lib/attendance.js";

export default async function numbatrakAttendanceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/attendance/settings",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/attendance/settings",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as { enabled?: boolean; autoCloseWindowMinutes?: number };
      const settings = await updateSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );

  app.get(
    "/org/numbatrak/attendance/events",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const events = await listEvents(db, organizationId);
      return reply.send({ events });
    },
  );

  app.post(
    "/org/numbatrak/attendance/events",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const body = request.body as { title: string; description?: string | null; eventDate: string };
      const event = await createEvent(db, organizationId, body, session.user.id);
      return reply.status(201).send(event);
    },
  );

  app.get(
    "/org/numbatrak/attendance/events/:eventId",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { eventId } = request.params as { eventId: string };
      const detail = await getEventDetail(db, organizationId, eventId);
      if (!detail) return reply.status(404).send({ error: "Event not found" });
      return reply.send(detail);
    },
  );

  app.post(
    "/org/numbatrak/attendance/events/:eventId/mark",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { eventId } = request.params as { eventId: string };
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const { staffId, status } = request.body as { staffId: string; status: string };
      const record = await markAttendance(db, eventId, staffId, status, session.user.id);
      return reply.send(record);
    },
  );

  app.post(
    "/org/numbatrak/attendance/events/:eventId/exempt",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const { eventId } = request.params as { eventId: string };
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const { staffId, exemptReason } = request.body as { staffId: string; exemptReason: string };
      const record = await exemptStaff(db, eventId, staffId, exemptReason, session.user.id);
      return reply.send(record);
    },
  );

  app.post(
    "/org/numbatrak/attendance/events/:eventId/close",
    { preHandler: app.requireOrgPermission({ numbatrakAttendance: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { eventId } = request.params as { eventId: string };
      const event = await closeEvent(db, organizationId, eventId);
      if (!event) return reply.status(404).send({ error: "Event not found" });
      return reply.send(event);
    },
  );
}
