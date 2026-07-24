import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  getOrCreateFeedbackSettings,
  updateFeedbackSettings,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  listFeedbackCalls,
  createFeedbackCall,
  dispositionFeedbackCall,
  listComplaints,
  createComplaint,
  escalateComplaint,
  resolveComplaint,
  listMorePurchases,
  createMorePurchase,
  updateMorePurchaseStatus,
  listCampaigns,
  createCampaign,
  sendCampaign,
  listCredits,
  addCredits,
  getFeedbackDashboard,
  getComplaintDashboard,
} from "../lib/crm.js";

export default async function numbatrakCrmRoutes(app: FastifyInstance): Promise<void> {
  // --- Feedback Settings ---
  app.get(
    "/org/numbatrak/crm/settings",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send(await getOrCreateFeedbackSettings(db, organizationId));
    },
  );

  app.patch(
    "/org/numbatrak/crm/settings",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as Record<string, unknown>;
      return reply.send(await updateFeedbackSettings(db, organizationId, body));
    },
  );

  // --- Customers ---
  app.get(
    "/org/numbatrak/crm/customers",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ customers: await listCustomers(db, organizationId) });
    },
  );

  app.get(
    "/org/numbatrak/crm/customers/:customerId",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { customerId } = request.params as { customerId: string };
      const customer = await getCustomer(db, organizationId, customerId);
      if (!customer) return reply.status(404).send({ error: "Customer not found" });
      return reply.send(customer);
    },
  );

  app.post(
    "/org/numbatrak/crm/customers",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as any;
      return reply.status(201).send(await createCustomer(db, organizationId, body));
    },
  );

  app.patch(
    "/org/numbatrak/crm/customers/:customerId",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { customerId } = request.params as { customerId: string };
      const body = request.body as Record<string, unknown>;
      const result = await updateCustomer(db, organizationId, customerId, body);
      if (!result) return reply.status(404).send({ error: "Customer not found" });
      return reply.send(result);
    },
  );

  // --- Feedback Calls ---
  app.get(
    "/org/numbatrak/crm/feedback-calls",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ calls: await listFeedbackCalls(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/crm/feedback-calls",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as any;
      return reply.status(201).send(await createFeedbackCall(db, organizationId, body));
    },
  );

  app.post(
    "/org/numbatrak/crm/feedback-calls/:callId/disposition",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { callId } = request.params as { callId: string };
      const body = request.body as any;
      const result = await dispositionFeedbackCall(db, organizationId, callId, body);
      if (!result) return reply.status(404).send({ error: "Feedback call not found" });
      return reply.send(result);
    },
  );

  // --- Complaints ---
  app.get(
    "/org/numbatrak/crm/complaints",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ complaints: await listComplaints(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/crm/complaints",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as any;
      return reply.status(201).send(await createComplaint(db, organizationId, body));
    },
  );

  app.post(
    "/org/numbatrak/crm/complaints/:complaintId/escalate",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { complaintId } = request.params as { complaintId: string };
      const result = await escalateComplaint(db, organizationId, complaintId);
      if (!result) return reply.status(404).send({ error: "Complaint not found" });
      return reply.send(result);
    },
  );

  app.post(
    "/org/numbatrak/crm/complaints/:complaintId/resolve",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { complaintId } = request.params as { complaintId: string };
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const body = request.body as any;
      const result = await resolveComplaint(db, organizationId, complaintId, session.user.id, body);
      if (!result) return reply.status(404).send({ error: "Complaint not found" });
      return reply.send(result);
    },
  );

  // --- More Purchases ---
  app.get(
    "/org/numbatrak/crm/more-purchases",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ purchases: await listMorePurchases(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/crm/more-purchases",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const body = request.body as any;
      return reply.status(201).send(await createMorePurchase(db, organizationId, body));
    },
  );

  app.patch(
    "/org/numbatrak/crm/more-purchases/:purchaseId/status",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { purchaseId } = request.params as { purchaseId: string };
      const { status } = request.body as { status: string };
      const result = await updateMorePurchaseStatus(db, organizationId, purchaseId, status);
      if (!result) return reply.status(404).send({ error: "Purchase not found" });
      return reply.send(result);
    },
  );

  // --- Campaigns ---
  app.get(
    "/org/numbatrak/crm/campaigns",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ campaigns: await listCampaigns(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/crm/campaigns",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session) return reply.status(401).send({ error: "Unauthorized" });
      const body = request.body as any;
      return reply.status(201).send(await createCampaign(db, organizationId, session.user.id, body));
    },
  );

  app.post(
    "/org/numbatrak/crm/campaigns/:campaignId/send",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { campaignId } = request.params as { campaignId: string };
      const result = await sendCampaign(db, organizationId, campaignId);
      if (!result) return reply.status(400).send({ error: "Campaign cannot be sent (not draft or no credits)" });
      return reply.send(result);
    },
  );

  // --- Credits ---
  app.get(
    "/org/numbatrak/crm/credits",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send({ credits: await listCredits(db, organizationId) });
    },
  );

  app.post(
    "/org/numbatrak/crm/credits",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const { channel, amount } = request.body as { channel: string; amount: number };
      return reply.status(201).send(await addCredits(db, organizationId, channel, amount));
    },
  );

  // --- Dashboards ---
  app.get(
    "/org/numbatrak/crm/feedback-dashboard",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send(await getFeedbackDashboard(db, organizationId));
    },
  );

  app.get(
    "/org/numbatrak/crm/complaint-dashboard",
    { preHandler: app.requireOrgPermission({ numbatrakCrm: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      return reply.send(await getComplaintDashboard(db, organizationId));
    },
  );
}
