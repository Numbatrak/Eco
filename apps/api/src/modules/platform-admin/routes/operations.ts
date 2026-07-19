import type { FastifyInstance } from "fastify";
import {
  createAnnouncementRequestSchema,
  churnQuerySchema,
  auditLogQuerySchema,
  errorLogQuerySchema,
  type AnnouncementsResponse,
} from "@platform/shared-types";
import {
  createAnnouncement,
  listAnnouncements,
  computeFeatureUsage,
  computeChurnAnalytics,
  getIntegrationHealth,
  listAuditLog,
  listErrorLog,
} from "../lib/operations-store.js";
import { logPlatformAdminAction } from "../lib/audit-log.js";

const DEFAULT_RANGE_DAYS = 90;

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 86400000);
  return { from: fromDate, to: toDate };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Operations (Tab 6). Announcements, feature usage, churn analytics,
 * integration health, and the (immutable) audit + error logs.
 */
export default async function operationsRoutes(app: FastifyInstance): Promise<void> {
  // --- announcements ---
  app.get("/platform-admin/operations/announcements", { preHandler: app.requirePlatformAdminAuth }, async (_req, reply) => {
    const response: AnnouncementsResponse = { announcements: await listAnnouncements(app.getDb()) };
    return reply.send(response);
  });

  app.post("/platform-admin/operations/announcements", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const body = createAnnouncementRequestSchema.parse(request.body);
    const db = app.getDb();
    const adminId = request.platformAdminId!;
    const announcement = await createAnnouncement(db, { ...body, adminId });
    await logPlatformAdminAction(db, {
      adminId,
      action: "announcement_broadcast",
      targetType: "announcement",
      targetId: announcement.id,
      details: { audience: body.audience, audienceValue: body.audienceValue, recipientCount: announcement.recipientCount },
    });
    return reply.code(201).send(announcement);
  });

  // --- feature usage ---
  app.get("/platform-admin/operations/feature-usage", { preHandler: app.requirePlatformAdminAuth }, async (_req, reply) => {
    return reply.send(await computeFeatureUsage(app.getDb()));
  });

  // --- churn analytics ---
  app.get("/platform-admin/operations/churn", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = churnQuerySchema.parse(request.query);
    const { from, to } = resolveRange(query.from, query.to);
    return reply.send(await computeChurnAnalytics(app.getDb(), from, to));
  });

  // --- integration health ---
  app.get("/platform-admin/operations/integration-health", { preHandler: app.requirePlatformAdminAuth }, async (_req, reply) => {
    return reply.send(await getIntegrationHealth(app.getDb()));
  });

  // --- audit log ---
  app.get("/platform-admin/operations/audit-log", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = auditLogQuerySchema.parse(request.query);
    return reply.send(await listAuditLog(app.getDb(), query));
  });

  app.get("/platform-admin/operations/audit-log/export.csv", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = auditLogQuerySchema.parse(request.query);
    const { entries } = await listAuditLog(app.getDb(), { ...query, page: 1, pageSize: 10000 });
    const header = "created_at,admin_id,action,target_type,target_id,details";
    const lines = entries.map((e) =>
      [e.createdAt, e.adminId, e.action, e.targetType, e.targetId, e.details].map(csvCell).join(","),
    );
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="audit-log.csv"')
      .send([header, ...lines].join("\n"));
  });

  // --- error log ---
  app.get("/platform-admin/operations/error-log", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = errorLogQuerySchema.parse(request.query);
    return reply.send(await listErrorLog(app.getDb(), query));
  });

  app.get("/platform-admin/operations/error-log/export.csv", { preHandler: app.requirePlatformAdminAuth }, async (request, reply) => {
    const query = errorLogQuerySchema.parse(request.query);
    const { entries } = await listErrorLog(app.getDb(), { ...query, page: 1, pageSize: 10000 });
    const header = "created_at,source,level,message,context";
    const lines = entries.map((e) => [e.createdAt, e.source, e.level, e.message, e.context].map(csvCell).join(","));
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="error-log.csv"')
      .send([header, ...lines].join("\n"));
  });
}
