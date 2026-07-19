import { and, desc, eq, gte, lte, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  organization,
  member,
  user,
  platformSubscriptions,
  platformPlans,
  platformCreditLedger,
  platformTransactions,
  platformAdminAuditLog,
  userActivityDays,
  products,
  orders,
  collections,
  tenantSiteConfig,
  tenantPaymentSettings,
  tenantAnalyticsSettings,
  tenantDeliverySettings,
  type Database,
} from "@platform/db";
import type {
  PlatformAdminTenantDetail,
  PlatformAdminTenantSummary,
  TenantLifecycleStatus,
} from "@platform/shared-types";
import { monthlyEquivalentCents } from "../../platform-billing/lib/metrics/mrr.js";

const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// A subscription row joined with its plan, as loaded for a tenant.
interface SubJoin {
  status: "trial" | "active" | "past_due" | "locked" | "cancelled";
  billingInterval: string;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  lockedAt: Date | null;
  cancelledAt: Date | null;
  planName: string | null;
  priceMonthlyCents: number | null;
  priceAnnuallyCents: number | null;
}

// Org suspension (admin block) takes precedence over the subscription state.
function deriveStatus(orgStatus: "active" | "suspended", sub: SubJoin | null): TenantLifecycleStatus {
  if (orgStatus === "suspended") return "suspended";
  if (!sub) return "active";
  return sub.status;
}

function retentionFlags(sub: SubJoin | null, now: Date): { inRetentionWindow: boolean; deletable: boolean } {
  if (!sub) return { inRetentionWindow: false, deletable: false };
  const ts = sub.status === "cancelled" ? sub.cancelledAt : sub.status === "locked" ? sub.lockedAt : null;
  if (!ts) return { inRetentionWindow: false, deletable: false };
  const deletable = now.getTime() - ts.getTime() >= RETENTION_MS;
  return { inRetentionWindow: !deletable, deletable };
}

function mrrContributionCents(
  orgStatus: "active" | "suspended",
  sub: SubJoin | null,
  now: Date,
): number {
  if (orgStatus !== "active" || !sub || sub.priceMonthlyCents === null || sub.priceAnnuallyCents === null) {
    return 0;
  }
  const counts = sub.status === "active" || (sub.status === "cancelled" && sub.currentPeriodEnd > now);
  if (!counts) return 0;
  return monthlyEquivalentCents(
    { priceMonthlyCents: sub.priceMonthlyCents, priceAnnuallyCents: sub.priceAnnuallyCents },
    sub.billingInterval,
  );
}

// Matches an org member holding the owner role, tolerating comma-joined
// multi-role values (e.g. "owner,editor").
const ownerRoleMatch = sql`'owner' = ANY(string_to_array(${member.role}, ','))`;

// ---------- batch enrichment (per page of tenant ids) ----------

async function loadOwnerEmails(db: Database, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ orgId: member.organizationId, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(inArray(member.organizationId, ids), ownerRoleMatch));
  for (const r of rows) {
    if (!map.has(r.orgId)) map.set(r.orgId, r.email);
  }
  return map;
}

async function loadTeamSizes(db: Database, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ orgId: member.organizationId, n: sql<number>`count(*)::int` })
    .from(member)
    .where(inArray(member.organizationId, ids))
    .groupBy(member.organizationId);
  for (const r of rows) map.set(r.orgId, r.n);
  return map;
}

async function loadCreditBalances(
  db: Database,
  ids: string[],
): Promise<Map<string, { email: number; whatsapp: number }>> {
  const map = new Map<string, { email: number; whatsapp: number }>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      orgId: platformCreditLedger.organizationId,
      creditType: platformCreditLedger.creditType,
      balance: sql<number>`coalesce(sum(${platformCreditLedger.delta}), 0)::int`,
    })
    .from(platformCreditLedger)
    .where(inArray(platformCreditLedger.organizationId, ids))
    .groupBy(platformCreditLedger.organizationId, platformCreditLedger.creditType);
  for (const r of rows) {
    const entry = map.get(r.orgId) ?? { email: 0, whatsapp: 0 };
    if (r.creditType === "email") entry.email = r.balance;
    else if (r.creditType === "whatsapp") entry.whatsapp = r.balance;
    map.set(r.orgId, entry);
  }
  return map;
}

async function loadLastActive(db: Database, ids: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      orgId: userActivityDays.organizationId,
      last: sql<Date>`max(${userActivityDays.lastSeenAt})`,
    })
    .from(userActivityDays)
    .where(inArray(userActivityDays.organizationId, ids))
    .groupBy(userActivityDays.organizationId);
  for (const r of rows) {
    if (r.orgId) map.set(r.orgId, r.last);
  }
  return map;
}

// ---------- list ----------

export interface ListTenantsParams {
  page: number;
  pageSize: number;
  search?: string;
  plan?: string;
  status?: TenantLifecycleStatus;
  signupSource?: string;
  from?: string;
  to?: string;
}

export interface ListTenantsResult {
  tenants: PlatformAdminTenantSummary[];
  total: number;
}

function statusCondition(status: TenantLifecycleStatus): SQL | undefined {
  if (status === "suspended") return eq(organization.status, "suspended");
  return and(eq(organization.status, "active"), eq(platformSubscriptions.status, status));
}

export async function listTenantsForAdmin(
  db: Database,
  params: ListTenantsParams,
): Promise<ListTenantsResult> {
  const now = new Date();
  const conditions: (SQL | undefined)[] = [];

  if (params.search) {
    const like = `%${params.search}%`;
    conditions.push(
      or(
        sql`lower(${organization.name}) like lower(${like})`,
        sql`lower(${organization.slug}) like lower(${like})`,
        sql`exists (select 1 from ${member} m join ${user} u on u.id = m.user_id
          where m.organization_id = ${organization.id}
          and 'owner' = ANY(string_to_array(m.role, ','))
          and lower(u.email) like lower(${like}))`,
      ),
    );
  }
  if (params.plan) conditions.push(eq(platformPlans.name, params.plan));
  if (params.status) conditions.push(statusCondition(params.status));
  if (params.signupSource) conditions.push(eq(organization.signupUtmSource, params.signupSource));
  if (params.from) conditions.push(gte(organization.createdAt, new Date(params.from)));
  if (params.to) conditions.push(lte(organization.createdAt, new Date(params.to)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organization)
    .leftJoin(platformSubscriptions, eq(platformSubscriptions.organizationId, organization.id))
    .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .where(where);
  const total = countRow?.count ?? 0;

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      orgStatus: organization.status,
      signupSource: organization.signupUtmSource,
      createdAt: organization.createdAt,
      subStatus: platformSubscriptions.status,
      billingInterval: platformSubscriptions.billingInterval,
      currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
      trialEndsAt: platformSubscriptions.trialEndsAt,
      gracePeriodEndsAt: platformSubscriptions.gracePeriodEndsAt,
      lockedAt: platformSubscriptions.lockedAt,
      cancelledAt: platformSubscriptions.cancelledAt,
      planName: platformPlans.name,
      priceMonthlyCents: platformPlans.priceMonthlyCents,
      priceAnnuallyCents: platformPlans.priceAnnuallyCents,
    })
    .from(organization)
    .leftJoin(platformSubscriptions, eq(platformSubscriptions.organizationId, organization.id))
    .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .where(where)
    .orderBy(desc(organization.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const ids = rows.map((r) => r.id);
  const [owners, teamSizes, credits, lastActive] = await Promise.all([
    loadOwnerEmails(db, ids),
    loadTeamSizes(db, ids),
    loadCreditBalances(db, ids),
    loadLastActive(db, ids),
  ]);

  const tenants = rows.map((r): PlatformAdminTenantSummary => {
    const sub: SubJoin | null = r.subStatus
      ? {
          status: r.subStatus,
          billingInterval: r.billingInterval!,
          currentPeriodEnd: r.currentPeriodEnd!,
          trialEndsAt: r.trialEndsAt,
          gracePeriodEndsAt: r.gracePeriodEndsAt,
          lockedAt: r.lockedAt,
          cancelledAt: r.cancelledAt,
          planName: r.planName,
          priceMonthlyCents: r.priceMonthlyCents,
          priceAnnuallyCents: r.priceAnnuallyCents,
        }
      : null;
    const bal = credits.get(r.id) ?? { email: 0, whatsapp: 0 };
    const last = lastActive.get(r.id);
    return {
      id: r.id,
      name: r.name,
      subdomain: r.subdomain,
      ownerEmail: owners.get(r.id) ?? null,
      status: deriveStatus(r.orgStatus, sub),
      planTier: sub?.planName ?? null,
      mrrContributionCents: mrrContributionCents(r.orgStatus, sub, now),
      teamSize: teamSizes.get(r.id) ?? 0,
      signupSource: r.signupSource ?? null,
      emailCredits: bal.email,
      whatsappCredits: bal.whatsapp,
      lastActiveAt: last ? new Date(last).toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return { tenants, total };
}

// ---------- detail (six sub-sections) ----------

async function loadSubJoin(db: Database, tenantId: string): Promise<SubJoin | null> {
  const [row] = await db
    .select({
      status: platformSubscriptions.status,
      billingInterval: platformSubscriptions.billingInterval,
      currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
      trialEndsAt: platformSubscriptions.trialEndsAt,
      gracePeriodEndsAt: platformSubscriptions.gracePeriodEndsAt,
      lockedAt: platformSubscriptions.lockedAt,
      cancelledAt: platformSubscriptions.cancelledAt,
      planName: platformPlans.name,
      priceMonthlyCents: platformPlans.priceMonthlyCents,
      priceAnnuallyCents: platformPlans.priceAnnuallyCents,
    })
    .from(platformSubscriptions)
    .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .where(eq(platformSubscriptions.organizationId, tenantId))
    .limit(1);
  return row ?? null;
}

async function loadCapabilities(db: Database, tenantId: string) {
  const [[prodRow], [collRow], [orderRow], [site], [pay], [analytics], [delivery]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${products.status} = 'published')::int`,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId)),
    db.select({ n: sql<number>`count(*)::int` }).from(collections).where(eq(collections.tenantId, tenantId)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.tenantId, tenantId)),
    db.select({ publishedAt: tenantSiteConfig.publishedAt }).from(tenantSiteConfig).where(eq(tenantSiteConfig.tenantId, tenantId)).limit(1),
    db.select({ enabled: tenantPaymentSettings.enabled }).from(tenantPaymentSettings).where(eq(tenantPaymentSettings.tenantId, tenantId)).limit(1),
    db.select({ enabled: tenantAnalyticsSettings.enabled }).from(tenantAnalyticsSettings).where(eq(tenantAnalyticsSettings.tenantId, tenantId)).limit(1),
    db.select({ fee: tenantDeliverySettings.deliveryFeeCents }).from(tenantDeliverySettings).where(eq(tenantDeliverySettings.tenantId, tenantId)).limit(1),
  ]);
  return {
    productCount: prodRow?.total ?? 0,
    publishedProductCount: prodRow?.published ?? 0,
    collectionCount: collRow?.n ?? 0,
    orderCount: orderRow?.n ?? 0,
    storefrontPublished: Boolean(site?.publishedAt),
    paymentConfigured: Boolean(pay?.enabled),
    analyticsConfigured: Boolean(analytics?.enabled),
    deliveryConfigured: delivery !== undefined,
  };
}

export async function getTenantDetailForAdmin(
  db: Database,
  tenantId: string,
): Promise<PlatformAdminTenantDetail | null> {
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      orgStatus: organization.status,
      signupSource: organization.signupUtmSource,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .where(eq(organization.id, tenantId))
    .limit(1);
  if (!org) return null;

  const now = new Date();
  const sub = await loadSubJoin(db, tenantId);

  const [owners, teamSizes, credits, lastActive, capabilities, txnRows, memberRows, ledgerRows, auditRows] =
    await Promise.all([
      loadOwnerEmails(db, [tenantId]),
      loadTeamSizes(db, [tenantId]),
      loadCreditBalances(db, [tenantId]),
      loadLastActive(db, [tenantId]),
      loadCapabilities(db, tenantId),
      db.select().from(platformTransactions).where(eq(platformTransactions.organizationId, tenantId)).orderBy(desc(platformTransactions.createdAt)).limit(100),
      db
        .select({ userId: member.userId, name: user.name, email: user.email, role: member.role, joinedAt: member.createdAt })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, tenantId))
        .orderBy(member.createdAt),
      db.select().from(platformCreditLedger).where(eq(platformCreditLedger.organizationId, tenantId)).orderBy(desc(platformCreditLedger.createdAt)).limit(100),
      db
        .select()
        .from(platformAdminAuditLog)
        .where(and(eq(platformAdminAuditLog.targetType, "tenant"), eq(platformAdminAuditLog.targetId, tenantId)))
        .orderBy(desc(platformAdminAuditLog.createdAt))
        .limit(100),
    ]);

  const bal = credits.get(tenantId) ?? { email: 0, whatsapp: 0 };
  const last = lastActive.get(tenantId);
  const { inRetentionWindow, deletable } = retentionFlags(sub, now);

  return {
    id: org.id,
    name: org.name,
    subdomain: org.subdomain,
    ownerEmail: owners.get(tenantId) ?? null,
    status: deriveStatus(org.orgStatus, sub),
    planTier: sub?.planName ?? null,
    mrrContributionCents: mrrContributionCents(org.orgStatus, sub, now),
    teamSize: teamSizes.get(tenantId) ?? 0,
    signupSource: org.signupSource ?? null,
    emailCredits: bal.email,
    whatsappCredits: bal.whatsapp,
    lastActiveAt: last ? new Date(last).toISOString() : null,
    createdAt: org.createdAt.toISOString(),
    subscription: sub
      ? {
          planTier: sub.planName,
          billingInterval: sub.billingInterval,
          status: deriveStatus(org.orgStatus, sub),
          mrrContributionCents: mrrContributionCents(org.orgStatus, sub, now),
          currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
          trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
          gracePeriodEndsAt: sub.gracePeriodEndsAt ? sub.gracePeriodEndsAt.toISOString() : null,
          lockedAt: sub.lockedAt ? sub.lockedAt.toISOString() : null,
          cancelledAt: sub.cancelledAt ? sub.cancelledAt.toISOString() : null,
          inRetentionWindow,
          deletable,
        }
      : null,
    transactions: txnRows.map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amountCents,
      vatCents: t.vatCents,
      paystackReference: t.paystackReference,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    })),
    capabilities,
    team: memberRows.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    credits: {
      emailBalance: bal.email,
      whatsappBalance: bal.whatsapp,
      history: ledgerRows.map((l) => ({
        id: l.id,
        creditType: l.creditType,
        delta: l.delta,
        reason: l.reason,
        source: l.delta < 0 ? ("consumption" as const) : l.transactionId ? ("purchase" as const) : ("admin_grant" as const),
        createdAt: l.createdAt.toISOString(),
      })),
    },
    activity: auditRows.map((a) => ({
      id: a.id,
      action: a.action,
      adminId: a.adminId,
      details: a.details ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------- actions ----------

export async function suspendTenant(db: Database, tenantId: string): Promise<void> {
  await db.update(organization).set({ status: "suspended" }).where(eq(organization.id, tenantId));
}

export async function reactivateTenant(db: Database, tenantId: string): Promise<void> {
  await db.update(organization).set({ status: "active" }).where(eq(organization.id, tenantId));
}

// Updates the display plan and, when the name maps to a real plan, keeps the
// org's plan_id and any subscription's plan_id in sync so MRR stays correct.
export async function updateTenantPlan(db: Database, tenantId: string, plan: string): Promise<void> {
  const [planRow] = await db.select({ id: platformPlans.id }).from(platformPlans).where(eq(platformPlans.name, plan)).limit(1);
  await db.update(organization).set({ plan, planId: planRow?.id ?? null }).where(eq(organization.id, tenantId));
  if (planRow) {
    await db.update(platformSubscriptions).set({ planId: planRow.id, updatedAt: new Date() }).where(eq(platformSubscriptions.organizationId, tenantId));
  }
}

export async function grantTenantCredits(
  db: Database,
  params: { tenantId: string; adminId: string; creditType: "email" | "whatsapp"; amount: number; reason: string },
): Promise<void> {
  await db.insert(platformCreditLedger).values({
    organizationId: params.tenantId,
    creditType: params.creditType,
    delta: params.amount,
    reason: params.reason,
    adminId: params.adminId,
  });
}

// Extends (or starts) the trial by N days from the later of now and the
// current trial end. Returns false if the tenant has no subscription.
export async function extendTrial(db: Database, tenantId: string, days: number): Promise<boolean> {
  const [sub] = await db
    .select({ trialEndsAt: platformSubscriptions.trialEndsAt })
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.organizationId, tenantId))
    .limit(1);
  if (!sub) return false;
  const now = new Date();
  const base = sub.trialEndsAt && sub.trialEndsAt > now ? sub.trialEndsAt : now;
  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await db
    .update(platformSubscriptions)
    .set({ trialEndsAt: newEnd, status: "trial", updatedAt: now })
    .where(eq(platformSubscriptions.organizationId, tenantId));
  return true;
}

export async function getOwnerEmail(db: Database, tenantId: string): Promise<string | null> {
  const map = await loadOwnerEmails(db, [tenantId]);
  return map.get(tenantId) ?? null;
}

// Whether the 90-day retention window has expired (delete allowed).
export async function isTenantDeletable(db: Database, tenantId: string): Promise<boolean> {
  const sub = await loadSubJoin(db, tenantId);
  return retentionFlags(sub, new Date()).deletable;
}

// Full data wipe: deleting the org cascades all tenant-owned data. The revenue
// ledger (platform_transactions) survives with organization_id nulled (see the
// FK) so historical revenue never changes retroactively.
export async function deleteTenant(db: Database, tenantId: string): Promise<void> {
  await db.delete(organization).where(eq(organization.id, tenantId));
}

export async function tenantExists(db: Database, tenantId: string): Promise<boolean> {
  const [row] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, tenantId)).limit(1);
  return Boolean(row);
}
