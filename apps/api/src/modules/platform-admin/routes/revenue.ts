import type { FastifyInstance } from "fastify";
import {
  revenueLedgerQuerySchema,
  taxViewQuerySchema,
  issueRefundRequestSchema,
  type RevenueLedgerResponse,
  type FailedPaymentsResponse,
} from "@platform/shared-types";
import {
  listTransactions,
  computeTaxView,
  listFailedPayments,
  buildLedgerCsv,
  buildTaxCsv,
} from "../../platform-billing/lib/revenue-store.js";
import { findTransactionByReference, markTransactionRefunded } from "../../platform-billing/lib/platform-transactions-store.js";
import { issuePaystackRefund } from "../../platform-billing/lib/platform-paystack.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

const CSV_EXPORT_CAP = 10000;
const DEFAULT_RANGE_DAYS = 30;

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  return { from: fromDate, to: toDate };
}

/**
 * Revenue (Tab 3). The transaction ledger is the single source of truth for
 * revenue — every view here reads platform_transactions, never a separate
 * counter. Refunds are subscription-only (credit purchases are final).
 */
export default async function revenueRoutes(app: FastifyInstance): Promise<void> {
  // --- transaction ledger ---
  app.get("/platform-admin/revenue/transactions", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = revenueLedgerQuerySchema.parse(request.query);
    const { transactions, total } = await listTransactions(app.getDb(), query);
    const response: RevenueLedgerResponse = { transactions, page: query.page, pageSize: query.pageSize, total };
    return reply.send(response);
  });

  app.get("/platform-admin/revenue/transactions/export.csv", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = revenueLedgerQuerySchema.parse(request.query);
    const { transactions } = await listTransactions(app.getDb(), { ...query, page: 1, pageSize: CSV_EXPORT_CAP });
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="transactions.csv"')
      .send(buildLedgerCsv(transactions));
  });

  // --- failed payments (dunning pipeline) ---
  app.get("/platform-admin/revenue/failed-payments", { preHandler: app.requirePlatformAdminAuth }, async (_request, reply) => {
    const response: FailedPaymentsResponse = { failedPayments: await listFailedPayments(app.getDb()) };
    return reply.send(response);
  });

  // --- tax view (FIRS) ---
  app.get("/platform-admin/revenue/tax", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = taxViewQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    return reply.send(await computeTaxView(app.getDb(), from, to));
  });

  app.get("/platform-admin/revenue/tax/export.csv", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = taxViewQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const tax = await computeTaxView(app.getDb(), from, to);
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="tax-report.csv"')
      .send(buildTaxCsv(tax));
  });

  // --- issue refund (subscription only) ---
  app.post<{ Params: { reference: string } }>(
    "/platform-admin/revenue/transactions/:reference/refund",
    { preHandler: app.requirePlatformAdminAuth },
    async (request, reply) => {
      const body = issueRefundRequestSchema.parse(request.body);
      const db = app.getDb();
      const { reference } = request.params;

      const txn = await findTransactionByReference(db, reference);
      if (!txn) return reply.code(404).send({ error: "transaction_not_found" });
      // LOCKED RULE: refunds on subscription payments only; credit purchases are final.
      if (txn.type !== "subscription") {
        return reply.code(409).send({ error: "credit_purchases_are_final" });
      }
      if (txn.status !== "success") {
        return reply.code(409).send({ error: "only_successful_charges_are_refundable" });
      }

      const result = await issuePaystackRefund(reference);
      if (!result.ok) {
        // Never flip the ledger for a refund Paystack didn't accept.
        return reply.code(502).send({ error: "refund_failed", message: result.message });
      }

      const now = new Date();
      await markTransactionRefunded(db, reference, body.reason, now);
      await logPlatformAdminAction(db, {
        adminId: request.platformAdminId!,
        action: "revenue_refund_issued",
        targetType: "transaction",
        targetId: reference,
        details: { reason: body.reason, amountCents: txn.amountCents, organizationId: txn.organizationId },
      });
      return reply.send({ ok: true, reference, status: "refunded" });
    },
  );
}
