import type { FastifyInstance } from "fastify";
import {
  setCreditPricingRequestSchema,
  createCreditBundleRequestSchema,
} from "@platform/shared-types";
import {
  getPricing,
  setPricing,
  listBundles,
  createBundle,
  bundleExists,
  deleteBundle,
  computeConsumption,
  computeMargin,
} from "../lib/credits-store.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

export default async function creditsRoutes(app: FastifyInstance): Promise<void> {
  // --- pricing ---
  app.get("/platform-admin/credits/pricing", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    return reply.send({ pricing: await getPricing(app.getDb()) });
  });

  app.put("/platform-admin/credits/pricing", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = setCreditPricingRequestSchema.parse(request.body);
    const db = app.getDb();
    await setPricing(db, { ...body, adminId: request.platformAdminId! });
    await logPlatformAdminAction(db, {
      adminId: request.platformAdminId!,
      action: "credit_pricing_updated",
      targetType: "credit_pricing",
      targetId: body.creditType,
      details: { sellPriceCents: body.sellPriceCents, providerCostCents: body.providerCostCents },
    });
    return reply.send({ pricing: await getPricing(db) });
  });

  // --- bundles ---
  app.get("/platform-admin/credits/bundles", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    return reply.send({ bundles: await listBundles(app.getDb()) });
  });

  app.post("/platform-admin/credits/bundles", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = createCreditBundleRequestSchema.parse(request.body);
    const db = app.getDb();
    const bundle = await createBundle(db, body);
    await logPlatformAdminAction(db, {
      adminId: request.platformAdminId!,
      action: "credit_bundle_created",
      targetType: "credit_bundle",
      targetId: bundle.id,
      details: { creditType: body.creditType, name: body.name, units: body.units, priceCents: body.priceCents },
    });
    return reply.code(201).send(bundle);
  });

  app.delete<{ Params: { id: string } }>(
    "/platform-admin/credits/bundles/:id",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const db = app.getDb();
      const { id } = request.params;
      if (!(await bundleExists(db, id))) {
        return reply.code(404).send({ error: "bundle_not_found" });
      }
      await deleteBundle(db, id);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "credit_bundle_deleted",
        targetType: "credit_bundle",
        targetId: id,
        details: {},
      });
      return reply.code(204).send();
    },
  );

  // --- consumption ---
  app.get("/platform-admin/credits/consumption", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    return reply.send(await computeConsumption(app.getDb()));
  });

  // --- margin ---
  app.get("/platform-admin/credits/margin", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    return reply.send(await computeMargin(app.getDb()));
  });
}
