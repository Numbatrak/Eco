import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { useOrganization } from "../contexts/OrganizationContext";
import {
  hasPermission,
  hasAnyRole,
  hasRole,
  canManageUsers,
  canManageResource,
  getPermissions,
} from "../utils/permissions";
import { UserRole } from "../types/user";

/**
 * Hook to check user permissions (now organization-scoped)
 */
export function usePermissions() {
  const { currentOrganization } = useOrganization();
  // Use organization role instead of user profile role
  const userRole = (currentOrganization?.role as UserRole) || null;

  return {
    userRole,
    hasPermission: (resource: string, action: string) =>
      hasPermission(userRole, resource as any, action as any),
    hasAnyRole: (roles: UserRole[]) => hasAnyRole(userRole, roles),
    hasRole: (role: UserRole) => hasRole(userRole, role),
    canManageUsers: () => canManageUsers(userRole),
    canManageResource: (resource: string) =>
      canManageResource(userRole, resource as any),
    permissions: getPermissions(userRole),
  };
}


