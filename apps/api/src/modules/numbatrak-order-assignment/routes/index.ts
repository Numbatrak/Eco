import type { FastifyInstance } from "fastify";
import {
  getOrCreateSettings,
  updateSettings,
  listWeights,
  upsertWeight,
  deleteWeight,
} from "../lib/order-assignment.js";

export default async function numbatrakOrderAssignmentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/order-assignment/settings",
    { preHandler: app.requireOrgPermission({ numbatrakOrderAssignment: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const settings = await getOrCreateSettings(db, organizationId);
      return reply.send(settings);
    },
  );

  app.patch(
    "/org/numbatrak/order-assignment/settings",
    { preHandler: app.requireOrgPermission({ numbatrakOrderAssignment: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as { assignmentMethod: string };
      const settings = await updateSettings(db, organizationId, body);
      return reply.send(settings);
    },
  );

  app.get(
    "/org/numbatrak/order-assignment/weights",
    { preHandler: app.requireOrgPermission({ numbatrakOrderAssignment: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const weights = await listWeights(db, organizationId);
      return reply.send({ weights });
    },
  );

  app.post(
    "/org/numbatrak/order-assignment/weights",
    { preHandler: app.requireOrgPermission({ numbatrakOrderAssignment: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { userId, percentage, isPaused } = request.body as { userId: string; percentage: number; isPaused?: boolean };
      const weight = await upsertWeight(db, organizationId, userId, percentage, isPaused);
      return reply.status(201).send(weight);
    },
  );

  app.delete(
    "/org/numbatrak/order-assignment/weights/:weightId",
    { preHandler: app.requireOrgPermission({ numbatrakOrderAssignment: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { weightId } = request.params as { weightId: string };
      const ok = await deleteWeight(db, organizationId, weightId);
      if (!ok) return reply.status(404).send({ error: "Weight not found" });
      return reply.send({ success: true });
    },
  );
}
