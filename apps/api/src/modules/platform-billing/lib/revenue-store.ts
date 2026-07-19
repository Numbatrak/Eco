import { and, desc, eq, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import {
  platformTransactions,
  platformSubscriptions,
  organization,
  member,
  user,
  type Database,
} from "@platform/db";
import type {
  RevenueLedgerQuery,
  RevenueTransaction,
  FailedPayment,
  TaxViewResponse,
} from "@platform/shared-types";
import { computeRevenueSplit } from "./metrics/revenue-split.js";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

interface TxnMeta {
  planName?: string;
  channel?: string;
  failureReason?: string;
}

// ---------- transaction ledger ----------

export async function listTransactions(
  db: Database,
  params: RevenueLedgerQuery,
): Promise<{ transactions: RevenueTransaction[]; total: number }> {
  const conditions: (SQL | undefined)[] = [];
  if (params.type) conditions.push(eq(platformTransactions.type, params.type));
  if (params.status) conditions.push(eq(platformTransactions.status, params.status));
  if (params.tenantId) conditions.push(eq(platformTransactions.organizationId, params.tenantId));
  if (params.tier) conditions.push(sql`${platformTransactions.metadata}->>'planName' = ${params.tier}`);
  if (params.from) conditions.push(gte(platformTransactions.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(platformTransactions.createdAt, new Date(params.to)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformTransactions)
    .where(where);

  const rows = await db
    .select({
      id: platformTransactions.id,
      organizationId: platformTransactions.organizationId,
      tenantName: organization.name,
      type: platformTransactions.type,
      metadata: platformTransactions.metadata,
      amountCents: platformTransactions.amountCents,
      vatCents: platformTransactions.vatCents,
      paystackReference: platformTransactions.paystackReference,
      status: platformTransactions.status,
      refundedAt: platformTransactions.refundedAt,
      refundReason: platformTransactions.refundReason,
      createdAt: platformTransactions.createdAt,
    })
    .from(platformTransactions)
    .leftJoin(organization, eq(platformTransactions.organizationId, organization.id))
    .where(where)
    .orderBy(desc(platformTransactions.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const transactions = rows.map((r): RevenueTransaction => {
    const meta = (r.metadata ?? {}) as TxnMeta;
    return {
      id: r.id,
      organizationId: r.organizationId,
      tenantName: r.tenantName ?? null,
      type: r.type,
      planTier: meta.planName ?? null,
      paymentMethod: meta.channel ?? null,
      amountCents: r.amountCents,
      vatCents: r.vatCents,
      paystackReference: r.paystackReference,
      status: r.status,
      refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
      refundReason: r.refundReason ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return { transactions, total: countRow?.count ?? 0 };
}

// ---------- tax view (FIRS) ----------

export async function computeTaxView(db: Database, from: Date, to: Date): Promise<TaxViewResponse> {
  const split = await computeRevenueSplit(db, from, to);

  const [refundRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${platformTransactions.amountCents}), 0)::int`,
    })
    .from(platformTransactions)
    .where(
      and(
        eq(platformTransactions.status, "refunded"),
        gte(platformTransactions.refundedAt, from),
        lte(platformTransactions.refundedAt, to),
      ),
    );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    grossCollectedCents: split.combined.grossCents,
    vatCollectedCents: split.combined.vatCents,
    taxableGrossCents: split.subscription.grossCents,
    nonTaxableGrossCents: split.credit.grossCents,
    netAfterVatCents: split.combined.netCents,
    refundsIssuedCount: refundRow?.count ?? 0,
    refundsIssuedCents: refundRow?.total ?? 0,
  };
}

// ---------- failed payments (dunning pipeline) ----------

const ownerRoleMatch = sql`'owner' = ANY(string_to_array(${member.role}, ','))`;

export async function listFailedPayments(db: Database): Promise<FailedPayment[]> {
  const subs = await db
    .select({
      organizationId: platformSubscriptions.organizationId,
      status: platformSubscriptions.status,
      gracePeriodEndsAt: platformSubscriptions.gracePeriodEndsAt,
      lockedAt: platformSubscriptions.lockedAt,
      tenantName: organization.name,
    })
    .from(platformSubscriptions)
    .innerJoin(organization, eq(platformSubscriptions.organizationId, organization.id))
    .where(inArray(platformSubscriptions.status, ["past_due", "locked"]))
    .orderBy(desc(platformSubscriptions.gracePeriodEndsAt));

  if (subs.length === 0) return [];
  const orgIds = subs.map((s) => s.organizationId);

  // Owner emails (comma-role tolerant).
  const ownerRows = await db
    .select({ orgId: member.organizationId, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(inArray(member.organizationId, orgIds), ownerRoleMatch));
  const owners = new Map<string, string>();
  for (const r of ownerRows) if (!owners.has(r.orgId)) owners.set(r.orgId, r.email);

  // Most recent failed transaction per org.
  const failedTxns = await db
    .select({
      organizationId: platformTransactions.organizationId,
      amountCents: platformTransactions.amountCents,
      paystackReference: platformTransactions.paystackReference,
      metadata: platformTransactions.metadata,
      createdAt: platformTransactions.createdAt,
    })
    .from(platformTransactions)
    .where(and(inArray(platformTransactions.organizationId, orgIds), eq(platformTransactions.status, "failed")))
    .orderBy(desc(platformTransactions.createdAt));
  const lastFailed = new Map<string, (typeof failedTxns)[number]>();
  for (const t of failedTxns) {
    if (t.organizationId && !lastFailed.has(t.organizationId)) lastFailed.set(t.organizationId, t);
  }

  return subs.map((s): FailedPayment => {
    const lf = lastFailed.get(s.organizationId);
    const meta = (lf?.metadata ?? {}) as TxnMeta;
    return {
      organizationId: s.organizationId,
      tenantName: s.tenantName,
      ownerEmail: owners.get(s.organizationId) ?? null,
      stage: s.status === "locked" ? "locked" : "grace",
      gracePeriodEndsAt: s.gracePeriodEndsAt ? s.gracePeriodEndsAt.toISOString() : null,
      lockedAt: s.lockedAt ? s.lockedAt.toISOString() : null,
      deleteAfter: s.lockedAt ? new Date(s.lockedAt.getTime() + RETENTION_MS).toISOString() : null,
      lastFailedAmountCents: lf?.amountCents ?? null,
      lastFailedReference: lf?.paystackReference ?? null,
      lastFailedAt: lf ? lf.createdAt.toISOString() : null,
      failureReason: meta.failureReason ?? null,
    };
  });
}

// ---------- CSV export ----------

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildLedgerCsv(transactions: RevenueTransaction[]): string {
  const header = [
    "date",
    "reference",
    "tenant",
    "type",
    "plan_tier",
    "payment_method",
    "amount_cents",
    "vat_cents",
    "status",
    "refunded_at",
  ];
  const lines = [header.join(",")];
  for (const t of transactions) {
    lines.push(
      [
        t.createdAt,
        t.paystackReference,
        t.tenantName ?? "",
        t.type,
        t.planTier ?? "",
        t.paymentMethod ?? "",
        t.amountCents,
        t.vatCents,
        t.status,
        t.refundedAt ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function buildTaxCsv(tax: TaxViewResponse): string {
  const rows: [string, string | number][] = [
    ["period_start", tax.from],
    ["period_end", tax.to],
    ["gross_collected_cents", tax.grossCollectedCents],
    ["vat_collected_cents", tax.vatCollectedCents],
    ["taxable_gross_cents", tax.taxableGrossCents],
    ["non_taxable_gross_cents", tax.nonTaxableGrossCents],
    ["net_after_vat_cents", tax.netAfterVatCents],
    ["refunds_issued_count", tax.refundsIssuedCount],
    ["refunds_issued_cents", tax.refundsIssuedCents],
  ];
  return ["metric,value", ...rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)].join("\n");
}
