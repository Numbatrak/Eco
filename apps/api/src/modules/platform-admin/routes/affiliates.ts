import type { FastifyInstance } from "fastify";
import {
  createAffiliateSchema,
  updateAffiliateStatusRequestSchema,
  recordAffiliatePayoutRequestSchema,
  affiliatePerformanceQuerySchema,
  type AffiliatesResponse,
} from "@platform/shared-types";
import {
  createAffiliate,
  listAffiliatesWithStats,
  getAffiliateDetail,
  setAffiliateStatus,
  recordPayout,
  computePerformance,
  getAffiliateForPerformance,
  affiliateExists,
} from "../lib/affiliates-store.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function affiliateRoutes(app: FastifyInstance): Promise<void> {
  app.get("/platform-admin/affiliates", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    const response: AffiliatesResponse = { affiliates: await listAffiliatesWithStats(app.getDb()) };
    return reply.send(response);
  });

  app.post("/platform-admin/affiliates", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = createAffiliateSchema.parse(request.body);
    const db = app.getDb();
    const adminId = request.platformAdminId!;
    const affiliate = await createAffiliate(db, {
      name: body.name,
      email: body.email,
      commissionRateBps: Math.round(body.commissionRatePct * 100),
      adminId,
    });
    await logPlatformAdminAction(db, {
      adminId,
      action: "affiliate_created",
      targetType: "affiliate",
      targetId: affiliate.id,
      details: { name: body.name, code: affiliate.code, commissionRateBps: affiliate.commissionRateBps },
    });
    const detail = await getAffiliateDetail(db, affiliate.id);
    return reply.code(201).send(detail);
  });

  app.get<{ Params: { id: string } }>(
    "/platform-admin/affiliates/:id",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const detail = await getAffiliateDetail(app.getDb(), request.params.id);
      if (!detail) return reply.code(404).send({ error: "affiliate_not_found" });
      return reply.send(detail);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/platform-admin/affiliates/:id/performance",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const query = affiliatePerformanceQuerySchema.parse(request.query);
      const db = app.getDb();
      const affiliate = await getAffiliateForPerformance(db, request.params.id);
      if (!affiliate) return reply.code(404).send({ error: "affiliate_not_found" });
      const performance = await computePerformance(
        db,
        affiliate.code,
        affiliate.commissionRateBps,
        query.from ? new Date(query.from) : undefined,
        query.to ? new Date(query.to) : undefined,
      );
      return reply.send(performance);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/platform-admin/affiliates/:id/status",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = updateAffiliateStatusRequestSchema.parse(request.body);
      const db = app.getDb();
      const { id } = request.params;
      if (!(await affiliateExists(db, id))) return reply.code(404).send({ error: "affiliate_not_found" });
      await setAffiliateStatus(db, id, body.status);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "affiliate_status_changed",
        targetType: "affiliate",
        targetId: id,
        details: { status: body.status },
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/platform-admin/affiliates/:id/payouts",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = recordAffiliatePayoutRequestSchema.parse(request.body);
      const db = app.getDb();
      const { id } = request.params;
      if (!(await affiliateExists(db, id))) return reply.code(404).send({ error: "affiliate_not_found" });
      await recordPayout(db, { affiliateId: id, amountCents: body.amountCents, note: body.note, adminId: request.platformAdminId! });
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "affiliate_payout_recorded",
        targetType: "affiliate",
        targetId: id,
        details: { amountCents: body.amountCents, note: body.note },
      });
      return reply.code(204).send();
    },
  );
}
