import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type { Database } from "@platform/db";
import { getSubscriptionForOrg, getAvailablePlans, changeSubscriptionPlan } from "../lib/settings.js";
import { cancelSubscription } from "../../platform-billing/lib/platform-subscriptions-store.js";
import { exportCustomersCsv, exportOrdersCsv } from "../lib/export.js";
import { listApiKeys, createApiKey, revokeApiKey } from "../lib/api-keys.js";
import { auth } from "../../../lib/auth.js";

const EXPORTERS: Record<string, (db: Database, organizationId: string) => Promise<string>> = {
  customers: exportCustomersCsv,
  orders: exportOrdersCsv,
};

const changePlanBody = z.object({
  planId: z.string().uuid(),
  billingInterval: z.enum(["monthly", "annual"]),
});

export default async function numbatrakSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/settings/subscription",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const subscription = await getSubscriptionForOrg(db, organizationId);
      return reply.send({ subscription });
    },
  );

  app.get(
    "/org/numbatrak/settings/plans",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const plans = await getAvailablePlans(db);
      return reply.send({ plans });
    },
  );

  // Tenant-facing upgrade/downgrade - owner/admin only.
  app.post(
    "/org/numbatrak/settings/subscription/change-plan",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = changePlanBody.parse(request.body);
      const ok = await changeSubscriptionPlan(db, organizationId, body.planId, body.billingInterval);
      if (!ok) return reply.status(404).send({ error: "Plan or subscription not found" });
      const subscription = await getSubscriptionForOrg(db, organizationId);
      return reply.send({ subscription });
    },
  );

  // Tenant-facing self-service cancellation - owner/admin only.
  app.delete(
    "/org/numbatrak/settings/subscription",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const existing = await getSubscriptionForOrg(db, organizationId);
      if (!existing) return reply.status(404).send({ error: "No active subscription" });
      await cancelSubscription(db, organizationId);
      return reply.status(204).send();
    },
  );

  // Data export - CSV of the org's own customers or orders. Owner/admin only.
  app.get<{ Params: { entity: string } }>(
    "/org/numbatrak/settings/export/:entity",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const { entity } = request.params;
      const exporter = EXPORTERS[entity];
      if (!exporter) return reply.status(404).send({ error: `Unknown export entity "${entity}"` });

      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const csv = await exporter(db, organizationId);
      return reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${entity}-export.csv"`)
        .send(csv);
    },
  );

  // --- API Keys ---
  app.get(
    "/org/numbatrak/settings/api-keys",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ apiKeys: await listApiKeys(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/settings/api-keys",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { name } = z.object({ name: z.string().trim().min(1) }).parse(request.body);
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const created = await createApiKey(db, organizationId, session.user.id, name);
      return reply.status(201).send(created);
    },
  );

  app.delete<{ Params: { keyId: string } }>(
    "/org/numbatrak/settings/api-keys/:keyId",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const ok = await revokeApiKey(db, organizationId, request.params.keyId);
      if (!ok) return reply.status(404).send({ error: "API key not found" });
      return reply.status(204).send();
    },
  );
}
