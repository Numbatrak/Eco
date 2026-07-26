import { ReactNode } from "react";
import { usePermissions } from "../hooks/usePermissions";
import { UserRole } from "../types/user";

interface PermissionGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: {
    resource: string;
    action: string;
  };
  fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on user permissions
 */
export function PermissionGuard({
  children,
  allowedRoles,
  requiredPermission,
  fallback = null,
}: PermissionGuardProps) {
  const { hasAnyRole, hasPermission } = usePermissions();

  // Check role-based access
  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  // Check permission-based access
  if (
    requiredPermission &&
    !hasPermission(requiredPermission.resource, requiredPermission.action)
  ) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}








