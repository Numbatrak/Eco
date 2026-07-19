import crypto from "node:crypto";
import { and, desc, eq, gte, lte, inArray, sql, type SQL, type AnyColumn } from "drizzle-orm";
import {
  affiliates,
  affiliatePayouts,
  organization,
  platformSubscriptions,
  platformTransactions,
  type Database,
} from "@platform/db";
import type {
  Affiliate,
  AffiliateDetail,
  AffiliatePerformance,
} from "@platform/shared-types";

export type AffiliateRow = typeof affiliates.$inferSelect;

function referralBaseUrl(): string {
  return process.env.MARKETING_URL ?? process.env.PUBLIC_APP_URL ?? "https://numbatrak.com";
}

// Referral link with the attribution UTMs baked in (LOCKED RULE):
// utm_source=affiliate, utm_medium=referral, utm_campaign=<code>.
export function buildReferralUrl(code: string): string {
  const base = referralBaseUrl().replace(/\/$/, "");
  return `${base}/?utm_source=affiliate&utm_medium=referral&utm_campaign=${encodeURIComponent(code)}`;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "aff"
  );
}

export async function createAffiliate(
  db: Database,
  params: { name: string; email?: string; commissionRateBps: number; adminId: string },
): Promise<AffiliateRow> {
  // Retry until the generated code wins the unique index.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `${slugify(params.name)}-${crypto.randomBytes(3).toString("hex")}`;
    const [row] = await db
      .insert(affiliates)
      .values({
        name: params.name,
        email: params.email ?? null,
        code,
        commissionRateBps: params.commissionRateBps,
        createdByAdminId: params.adminId,
      })
      .onConflictDoNothing({ target: affiliates.code })
      .returning();
    if (row) return row;
  }
  throw new Error("could not generate a unique affiliate code");
}

export async function affiliateExists(db: Database, id: string): Promise<boolean> {
  const [row] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.id, id)).limit(1);
  return Boolean(row);
}

export async function setAffiliateStatus(
  db: Database,
  id: string,
  status: "active" | "paused",
): Promise<void> {
  await db.update(affiliates).set({ status, updatedAt: new Date() }).where(eq(affiliates.id, id));
}

export async function recordPayout(
  db: Database,
  params: { affiliateId: string; amountCents: number; note?: string; adminId: string },
): Promise<void> {
  await db.insert(affiliatePayouts).values({
    affiliateId: params.affiliateId,
    amountCents: params.amountCents,
    note: params.note ?? null,
    recordedByAdminId: params.adminId,
  });
}

async function referredOrgIds(db: Database, code: string): Promise<string[]> {
  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(and(eq(organization.signupUtmSource, "affiliate"), eq(organization.signupUtmCampaign, code)));
  return rows.map((r) => r.id);
}

/**
 * Per-affiliate performance over an optional date range. Attribution is the
 * UTM join (org.signup_utm_campaign = code). Commission is the affiliate's rate
 * applied to net-of-VAT subscription revenue from referred tenants (VAT is
 * pass-through, not Numbatrak's revenue, so it isn't commissionable).
 */
export async function computePerformance(
  db: Database,
  code: string,
  commissionRateBps: number,
  from?: Date,
  to?: Date,
): Promise<AffiliatePerformance> {
  const ids = await referredOrgIds(db, code);
  if (ids.length === 0) {
    return { signups: 0, trialsStarted: 0, conversions: 0, revenueAttributedCents: 0, commissionEarnedCents: 0 };
  }

  const inRange = (col: AnyColumn): (SQL | undefined)[] => [
    from ? gte(col, from) : undefined,
    to ? lte(col, to) : undefined,
  ];

  const [signupRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(organization)
    .where(and(inArray(organization.id, ids), ...inRange(organization.createdAt)));

  const [trialRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformSubscriptions)
    .where(
      and(
        inArray(platformSubscriptions.organizationId, ids),
        sql`${platformSubscriptions.trialEndsAt} is not null`,
        ...inRange(platformSubscriptions.createdAt),
      ),
    );

  const [convRow] = await db
    .select({ n: sql<number>`count(distinct ${platformTransactions.organizationId})::int` })
    .from(platformTransactions)
    .where(
      and(
        inArray(platformTransactions.organizationId, ids),
        eq(platformTransactions.type, "subscription"),
        eq(platformTransactions.status, "success"),
        ...inRange(platformTransactions.createdAt),
      ),
    );

  const [revRow] = await db
    .select({
      net: sql<number>`coalesce(sum(${platformTransactions.amountCents} - ${platformTransactions.vatCents}), 0)::int`,
    })
    .from(platformTransactions)
    .where(
      and(
        inArray(platformTransactions.organizationId, ids),
        eq(platformTransactions.type, "subscription"),
        eq(platformTransactions.status, "success"),
        ...inRange(platformTransactions.createdAt),
      ),
    );

  const revenueAttributedCents = revRow?.net ?? 0;
  return {
    signups: signupRow?.n ?? 0,
    trialsStarted: trialRow?.n ?? 0,
    conversions: convRow?.n ?? 0,
    revenueAttributedCents,
    commissionEarnedCents: Math.round((commissionRateBps / 10000) * revenueAttributedCents),
  };
}

async function totalPaid(db: Database, affiliateId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${affiliatePayouts.amountCents}), 0)::int` })
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.affiliateId, affiliateId));
  return row?.total ?? 0;
}

function serialize(row: AffiliateRow, performance: AffiliatePerformance, paid: number): Affiliate {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    code: row.code,
    referralUrl: buildReferralUrl(row.code),
    commissionRateBps: row.commissionRateBps,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    performance,
    totalPaidCents: paid,
    commissionOwedCents: Math.max(0, performance.commissionEarnedCents - paid),
  };
}

export async function listAffiliatesWithStats(db: Database): Promise<Affiliate[]> {
  const rows = await db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
  // Lifetime performance (no date filter) for the summary + owed position.
  return Promise.all(
    rows.map(async (row) => {
      const [performance, paid] = await Promise.all([
        computePerformance(db, row.code, row.commissionRateBps),
        totalPaid(db, row.id),
      ]);
      return serialize(row, performance, paid);
    }),
  );
}

export async function getAffiliateDetail(db: Database, id: string): Promise<AffiliateDetail | null> {
  const [row] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
  if (!row) return null;
  const [performance, paid, payoutRows] = await Promise.all([
    computePerformance(db, row.code, row.commissionRateBps),
    totalPaid(db, row.id),
    db.select().from(affiliatePayouts).where(eq(affiliatePayouts.affiliateId, id)).orderBy(desc(affiliatePayouts.paidAt)),
  ]);
  return {
    ...serialize(row, performance, paid),
    payouts: payoutRows.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
    })),
  };
}

export async function getAffiliateForPerformance(
  db: Database,
  id: string,
): Promise<{ code: string; commissionRateBps: number } | null> {
  const [row] = await db
    .select({ code: affiliates.code, commissionRateBps: affiliates.commissionRateBps })
    .from(affiliates)
    .where(eq(affiliates.id, id))
    .limit(1);
  return row ?? null;
}
