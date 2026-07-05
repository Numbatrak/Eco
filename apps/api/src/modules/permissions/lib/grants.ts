import { tenantMemberPermissions, type Database } from "@platform/db";
import { ROLE_DEFAULT_PERMISSIONS, type TenantMemberRole } from "./permissions.js";

// Accepts a plain Database or a transaction handle - both expose `.insert`
// with the same shape, and this helper is called from inside
// createTenantWithOwner's transaction as well as (in the future) standalone.
type Inserter = Pick<Database, "insert">;

export async function grantPermissionsForRole(
  db: Inserter,
  tenantMemberId: string,
  role: TenantMemberRole,
): Promise<void> {
  const keys = ROLE_DEFAULT_PERMISSIONS[role];
  if (keys.length === 0) {
    return;
  }
  await db
    .insert(tenantMemberPermissions)
    .values(keys.map((permissionKey) => ({ tenantMemberId, permissionKey })));
}
