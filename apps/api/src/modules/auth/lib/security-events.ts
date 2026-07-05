import type { Database } from "@platform/db";
import { securityEvents } from "@platform/db";

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "2fa_challenge_issued"
  | "2fa_verified"
  | "2fa_failed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "backup_code_used"
  | "backup_codes_regenerated"
  | "password_reset_requested"
  | "password_reset_completed"
  | "sessions_revoked";

export interface SecurityEventParams {
  userId?: string;
  eventType: SecurityEventType;
  ip?: string;
  userAgent?: string;
}

export async function logSecurityEvent(db: Database, params: SecurityEventParams): Promise<void> {
  await db.insert(securityEvents).values({
    userId: params.userId,
    eventType: params.eventType,
    ipAddress: params.ip,
    userAgent: params.userAgent,
  });
}
