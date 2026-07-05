import { and, eq } from "drizzle-orm";
import { tenantMembers, tenantMemberPermissions, type Database } from "@platform/db";
import type { PermissionKey, TenantMemberRole } from "./permissions.js";

export interface TenantMembership {
  tenantMemberId: string;
  role: TenantMemberRole;
}

export async function findTenantMembership(
  db: Database,
  tenantId: string,
  userId: string,
): Promise<TenantMembership | null> {
  const [row] = await db
    .select({ id: tenantMembers.id, role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .limit(1);
  return row ? { tenantMemberId: row.id, role: row.role } : null;
}

export async function memberHasPermission(
  db: Database,
  tenantMemberId: string,
  permissionKey: PermissionKey,
): Promise<boolean> {
  const [row] = await db
    .select({ permissionKey: tenantMemberPermissions.permissionKey })
    .from(tenantMemberPermissions)
    .where(
      and(
        eq(tenantMemberPermissions.tenantMemberId, tenantMemberId),
        eq(tenantMemberPermissions.permissionKey, permissionKey),
      ),
    )
    .limit(1);
  return Boolean(row);
}
