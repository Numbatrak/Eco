import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import {
  announcements,
  exitSurveys,
  platformErrorLog,
  platformAdminAuditLog,
  organization,
  platformSubscriptions,
  platformPlans,
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
  Announcement,
  CreateAnnouncementRequest,
  FeatureUsageResponse,
  ChurnAnalyticsResponse,
  IntegrationHealthResponse,
  AuditLogQuery,
  AuditLogResponse,
  ErrorLogQuery,
  ErrorLogResponse,
} from "@platform/shared-types";

// ---------- error log (also the write path used by the API error handler) ----------

export async function recordError(
  db: Database,
  params: { source: string; level?: string; message: string; context?: unknown },
): Promise<void> {
  await db.insert(platformErrorLog).values({
    source: params.source,
    level: params.level ?? "error",
    message: params.message.slice(0, 4000),
    context: params.context ?? null,
  });
}

export async function listErrorLog(db: Database, query: ErrorLogQuery): Promise<ErrorLogResponse> {
  const conditions: (SQL | undefined)[] = [];
  if (query.source) conditions.push(eq(platformErrorLog.source, query.source));
  if (query.from) conditions.push(gte(platformErrorLog.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(platformErrorLog.createdAt, new Date(query.to)));
  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(platformErrorLog).where(where);
  const rows = await db
    .select()
    .from(platformErrorLog)
    .where(where)
    .orderBy(desc(platformErrorLog.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      source: r.source,
      level: r.level,
      message: r.message,
      context: r.context ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow?.n ?? 0,
  };
}

// ---------- audit log ----------

export async function listAuditLog(db: Database, query: AuditLogQuery): Promise<AuditLogResponse> {
  const conditions: (SQL | undefined)[] = [];
  if (query.adminId) conditions.push(eq(platformAdminAuditLog.adminId, query.adminId));
  if (query.action) conditions.push(eq(platformAdminAuditLog.action, query.action));
  if (query.targetId) conditions.push(eq(platformAdminAuditLog.targetId, query.targetId));
  if (query.from) conditions.push(gte(platformAdminAuditLog.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(platformAdminAuditLog.createdAt, new Date(query.to)));
  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(platformAdminAuditLog).where(where);
  const rows = await db
    .select()
    .from(platformAdminAuditLog)
    .where(where)
    .orderBy(desc(platformAdminAuditLog.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      adminId: r.adminId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      details: r.details ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: countRow?.n ?? 0,
  };
}

// ---------- announcements ----------

async function resolveRecipientCount(db: Database, audience: string, audienceValue?: string): Promise<number> {
  if (audience === "all") {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(organization);
    return row?.n ?? 0;
  }
  if (audience === "tenant") {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(organization)
      .where(eq(organization.id, audienceValue ?? ""));
    return row?.n ?? 0;
  }
  // tier — count subscribed orgs on that plan tier
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformSubscriptions)
    .innerJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .where(eq(platformPlans.name, audienceValue ?? ""));
  return row?.n ?? 0;
}

export async function createAnnouncement(
  db: Database,
  params: CreateAnnouncementRequest & { adminId: string },
): Promise<Announcement> {
  const recipientCount = await resolveRecipientCount(db, params.audience, params.audienceValue);
  const [row] = await db
    .insert(announcements)
    .values({
      title: params.title,
      body: params.body,
      audience: params.audience,
      audienceValue: params.audienceValue ?? null,
      sendEmail: params.sendEmail,
      recipientCount,
      createdByAdminId: params.adminId,
    })
    .returning();
  return serializeAnnouncement(row!);
}

function serializeAnnouncement(row: typeof announcements.$inferSelect): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    audienceValue: row.audienceValue,
    sendEmail: row.sendEmail,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAnnouncements(db: Database): Promise<Announcement[]> {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
  return rows.map(serializeAnnouncement);
}

// ---------- feature usage (capability adoption) ----------

export async function computeFeatureUsage(db: Database): Promise<FeatureUsageResponse> {
  const [totalRow] = await db.select({ n: sql<number>`count(*)::int` }).from(organization);
  const totalTenants = totalRow?.n ?? 0;

  const [prod, ord, coll, storefront, pay, analytics, delivery] = await Promise.all([
    db.select({ n: sql<number>`count(distinct ${products.tenantId})::int` }).from(products),
    db.select({ n: sql<number>`count(distinct ${orders.tenantId})::int` }).from(orders),
    db.select({ n: sql<number>`count(distinct ${collections.tenantId})::int` }).from(collections),
    db.select({ n: sql<number>`count(*)::int` }).from(tenantSiteConfig).where(sql`${tenantSiteConfig.publishedAt} is not null`),
    db.select({ n: sql<number>`count(*)::int` }).from(tenantPaymentSettings).where(eq(tenantPaymentSettings.enabled, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(tenantAnalyticsSettings).where(eq(tenantAnalyticsSettings.enabled, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(tenantDeliverySettings),
  ]);

  const raw: { key: string; label: string; adopted: number }[] = [
    { key: "products", label: "Products", adopted: prod[0]?.n ?? 0 },
    { key: "orders", label: "Orders", adopted: ord[0]?.n ?? 0 },
    { key: "collections", label: "Collections", adopted: coll[0]?.n ?? 0 },
    { key: "storefront", label: "Published storefront", adopted: storefront[0]?.n ?? 0 },
    { key: "payments", label: "Payments configured", adopted: pay[0]?.n ?? 0 },
    { key: "analytics", label: "Analytics configured", adopted: analytics[0]?.n ?? 0 },
    { key: "delivery", label: "Delivery configured", adopted: delivery[0]?.n ?? 0 },
  ];

  return {
    totalTenants,
    features: raw
      .map((f) => ({ ...f, rate: totalTenants > 0 ? f.adopted / totalTenants : 0 }))
      .sort((a, b) => b.rate - a.rate),
  };
}

// ---------- churn analytics ----------

function tenureBucket(days: number): string {
  if (days < 30) return "< 30 days";
  if (days < 90) return "30–90 days";
  if (days < 180) return "90–180 days";
  return "180+ days";
}

export async function computeChurnAnalytics(db: Database, from: Date, to: Date): Promise<ChurnAnalyticsResponse> {
  // Churn events = subscription cancellations in range (tier + tenure derived).
  const churned = await db
    .select({
      cancelledAt: platformSubscriptions.cancelledAt,
      orgCreatedAt: organization.createdAt,
      planName: platformPlans.name,
    })
    .from(platformSubscriptions)
    .innerJoin(organization, eq(platformSubscriptions.organizationId, organization.id))
    .innerJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .where(
      and(
        sql`${platformSubscriptions.cancelledAt} is not null`,
        gte(platformSubscriptions.cancelledAt, from),
        lte(platformSubscriptions.cancelledAt, to),
      ),
    );

  const tierCounts = new Map<string, number>();
  const tenureCounts = new Map<string, number>();
  for (const row of churned) {
    tierCounts.set(row.planName, (tierCounts.get(row.planName) ?? 0) + 1);
    if (row.cancelledAt) {
      const days = Math.max(0, Math.floor((row.cancelledAt.getTime() - row.orgCreatedAt.getTime()) / 86400000));
      const bucket = tenureBucket(days);
      tenureCounts.set(bucket, (tenureCounts.get(bucket) ?? 0) + 1);
    }
  }

  // Reasons + exit type from exit surveys in range (capture is wired at the
  // cancel/delete flows; empty until then).
  const surveys = await db
    .select({ reasonCategory: exitSurveys.reasonCategory, exitType: exitSurveys.exitType })
    .from(exitSurveys)
    .where(and(gte(exitSurveys.createdAt, from), lte(exitSurveys.createdAt, to)));

  const reasonCounts = new Map<string, number>();
  const exitTypeCounts = new Map<string, number>();
  for (const s of surveys) {
    reasonCounts.set(s.reasonCategory, (reasonCounts.get(s.reasonCategory) ?? 0) + 1);
    exitTypeCounts.set(s.exitType, (exitTypeCounts.get(s.exitType) ?? 0) + 1);
  }

  const toArr = (m: Map<string, number>) =>
    [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalChurned: churned.length,
    byTier: toArr(tierCounts),
    byTenure: toArr(tenureCounts),
    byReason: toArr(reasonCounts),
    byExitType: toArr(exitTypeCounts),
    hasSurveyData: surveys.length > 0,
  };
}

// ---------- integration health ----------

export async function getIntegrationHealth(db: Database): Promise<IntegrationHealthResponse> {
  const since = new Date(Date.now() - 7 * 86400000);
  const errorRows = await db
    .select({ source: platformErrorLog.source, n: sql<number>`count(*)::int` })
    .from(platformErrorLog)
    .where(gte(platformErrorLog.createdAt, since))
    .groupBy(platformErrorLog.source);
  const errorsBySource = new Map(errorRows.map((r) => [r.source, r.n]));

  const configs: { key: string; label: string; configured: boolean; errorSource: string }[] = [
    { key: "paystack", label: "Paystack (platform)", configured: Boolean(process.env.PLATFORM_PAYSTACK_SECRET_KEY), errorSource: "webhook" },
    { key: "email", label: "Email provider", configured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.EMAIL_FROM), errorSource: "email" },
    { key: "whatsapp", label: "WhatsApp API", configured: Boolean(process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_TOKEN), errorSource: "whatsapp" },
  ];

  return {
    integrations: configs.map((c) => {
      const recentErrors = errorsBySource.get(c.errorSource) ?? 0;
      const status = !c.configured ? "not_configured" : recentErrors > 0 ? "erroring" : "healthy";
      return { key: c.key, label: c.label, status, recentErrors };
    }),
  };
}
