import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  createInvoiceFromOrder,
  markInvoiceSent,
  markInvoicePaid,
  voidInvoice,
} from "../lib/invoicing.js";

export default async function numbatrakInvoicingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/invoices",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const invoices = await listInvoices(db, organizationId);
      return reply.send({ invoices });
    },
  );

  app.get<{ Params: { invoiceId: string } }>(
    "/org/numbatrak/invoices/:invoiceId",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const invoice = await getInvoice(db, organizationId, request.params.invoiceId);
      if (!invoice) return reply.status(404).send({ error: "Invoice not found" });
      return reply.send(invoice);
    },
  );

  app.post(
    "/org/numbatrak/invoices",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      const body = request.body as Record<string, unknown>;
      const invoice = await createInvoice(db, organizationId, {
        ...body,
        createdBy: session?.user.id,
      });
      return reply.status(201).send(invoice);
    },
  );

  app.post<{ Params: { orderId: string } }>(
    "/org/numbatrak/invoices/from-order/:orderId",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      const invoice = await createInvoiceFromOrder(db, organizationId, request.params.orderId, session?.user.id);
      return reply.status(201).send(invoice);
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/org/numbatrak/invoices/:invoiceId/send",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const invoice = await markInvoiceSent(db, organizationId, request.params.invoiceId);
      return reply.send(invoice);
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/org/numbatrak/invoices/:invoiceId/paid",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const invoice = await markInvoicePaid(db, organizationId, request.params.invoiceId);
      return reply.send(invoice);
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/org/numbatrak/invoices/:invoiceId/void",
    { preHandler: app.requireOrgMembership() },
    async (request, reply) => {
      const db = app.getDb();
      const organizationId = request.activeOrganizationId!;
      const invoice = await voidInvoice(db, organizationId, request.params.invoiceId);
      return reply.send(invoice);
    },
  );
}
