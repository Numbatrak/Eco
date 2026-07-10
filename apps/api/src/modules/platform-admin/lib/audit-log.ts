import { platformAdminAuditLog, type Database } from "@platform/db";

export interface AuditLogParams {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
}

/**
 * Every mutating action under /platform-admin/* writes here before
 * returning success - mirrors auth/lib/security-events.ts's
 * logSecurityEvent shape/semantics.
 */
export async function logPlatformAdminAction(db: Database, params: AuditLogParams): Promise<void> {
  await db.insert(platformAdminAuditLog).values({
    adminId: params.adminId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
  });
}
