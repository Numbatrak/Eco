import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  getOrCreateSettings,
  updateSettings,
  listContractors,
  createContractor,
  deleteContractor,
  listBatches,
  createBatch,
  markBatchDone,
  listPayments,
  payContractor,
  listAds,
  listSpend,
  createSpend,
  updateSpend,
  deleteSpend,
  listTargets,
  upsertTarget,
  deleteTarget,
  listReviews,
  createReview,
  getPerformanceAnalytics,
} from "../lib/media-buyers.js";

export default async function numbatrakMediaBuyersRoutes(app: FastifyInstance): Promise<void> {
  // --- Settings ---
  app.get(
    "/org/numbatrak/media-buyers/settings",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send(await getOrCreateSettings(db, organizationId));
    },
  );

  app.patch(
    "/org/numbatrak/media-buyers/settings",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      return reply.send(await updateSettings(db, organizationId, body));
    },
  );

  // --- Contractors ---
  app.get(
    "/org/numbatrak/media-buyers/contractors",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ contractors: await listContractors(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/contractors",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as { name: string; role: string; rate: number };
      return reply.status(201).send(await createContractor(db, organizationId, body));
    },
  );

  app.delete(
    "/org/numbatrak/media-buyers/contractors/:contractorId",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { contractorId } = request.params as { contractorId: string };
      const ok = await deleteContractor(db, organizationId, contractorId);
      if (!ok) return reply.status(404).send({ error: "Contractor not found" });
      return reply.send({ success: true });
    },
  );

  // --- Production Batches ---
  app.get(
    "/org/numbatrak/media-buyers/batches",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ batches: await listBatches(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/batches",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      return reply.status(201).send(await createBatch(db, organizationId, body as any));
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/batches/:batchId/done",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { batchId } = request.params as { batchId: string };
      const { driveLink } = (request.body as { driveLink?: string }) ?? {};
      const batch = await markBatchDone(db, organizationId, batchId, driveLink ?? null);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });
      return reply.send(batch);
    },
  );

  // --- Contractor Payments ---
  app.get(
    "/org/numbatrak/media-buyers/payments",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ payments: await listPayments(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/payments",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { contractorId, pieces, amount, brand } = request.body as {
        contractorId: string;
        pieces: number;
        amount: number;
        brand?: string | null;
      };
      return reply.status(201).send(await payContractor(db, organizationId, contractorId, pieces, amount, brand ?? null));
    },
  );

  // --- Ad Catalog ---
  app.get(
    "/org/numbatrak/media-buyers/ads",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ ads: await listAds(db, organizationId) });
    },
  );

  // --- Ad Spend ---
  app.get(
    "/org/numbatrak/media-buyers/spend",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ entries: await listSpend(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/spend",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const body = request.body as any;
      return reply.status(201).send(await createSpend(db, organizationId, session.user.id, body));
    },
  );

  app.patch(
    "/org/numbatrak/media-buyers/spend/:spendId",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { spendId } = request.params as { spendId: string };
      const body = request.body as { spend?: number; orders?: number };
      const result = await updateSpend(db, organizationId, spendId, body);
      if (!result) return reply.status(404).send({ error: "Spend entry not found" });
      return reply.send(result);
    },
  );

  app.delete(
    "/org/numbatrak/media-buyers/spend/:spendId",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { spendId } = request.params as { spendId: string };
      const ok = await deleteSpend(db, organizationId, spendId);
      if (!ok) return reply.status(404).send({ error: "Spend entry not found" });
      return reply.send({ success: true });
    },
  );

  // --- CPA Targets ---
  app.get(
    "/org/numbatrak/media-buyers/targets",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ targets: await listTargets(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/targets",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as any;
      return reply.status(201).send(await upsertTarget(db, organizationId, body));
    },
  );

  app.delete(
    "/org/numbatrak/media-buyers/targets/:targetId",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { targetId } = request.params as { targetId: string };
      const ok = await deleteTarget(db, organizationId, targetId);
      if (!ok) return reply.status(404).send({ error: "Target not found" });
      return reply.send({ success: true });
    },
  );

  // --- Weekly Reviews ---
  app.get(
    "/org/numbatrak/media-buyers/reviews",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ reviews: await listReviews(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/media-buyers/reviews",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const body = request.body as any;
      return reply.status(201).send(await createReview(db, organizationId, session.user.id, body));
    },
  );

  // --- Performance Analytics ---
  app.get(
    "/org/numbatrak/media-buyers/analytics",
    { preHandler: app.requireOrgPermission({ numbatrakMediaBuyers: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ analytics: await getPerformanceAnalytics(db, organizationId) });
    },
  );
}
