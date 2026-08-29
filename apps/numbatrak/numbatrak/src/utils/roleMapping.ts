import type { OrgRole } from "../lib/authApi";
import type { UserRole } from "../types/user";

/**
 * Maps the platform's shared org role (apps/api access-control.ts) onto
 * Numbatrak's own role vocabulary, which every existing Numbatrak
 * component/permission check (utils/permissions.ts, usePermissions.ts, and
 * every UserRole-typed prop across the app) still expects. Keeping this
 * mapping at the OrganizationContext boundary means none of those existing
 * consumers need to change for this port.
 *
 * `editor`/`viewer` are storefront-only roles with no Numbatrak grants
 * (see access-control.ts) - they shouldn't normally appear on a member of a
 * Numbatrak-using organization, but fall back to the least-privileged
 * Numbatrak role rather than throwing if they ever do.
 */
export function mapOrgRoleToUserRole(role: OrgRole): UserRole {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "csr":
      return "Customer Relations";
    case "editor":
    case "viewer":
    default:
      return "Customer Relations";
  }
}

/** Inverse of mapOrgRoleToUserRole, for writes (invite/update-role calls
 * against apps/api's Better Auth organization plugin). */
export function mapUserRoleToOrgRole(role: UserRole): OrgRole {
  switch (role) {
    case "Owner":
      return "owner";
    case "Admin":
      return "admin";
    case "Manager":
      return "manager";
    case "Customer Relations":
    default:
      return "csr";
  }
}
