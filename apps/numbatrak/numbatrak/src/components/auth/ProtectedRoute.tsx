import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import type { UserRole } from "../../types/user";
import type { Permission } from "../../types/user";

type Resource = keyof import("../../types/user").RolePermissions;

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  permission?: { resource: Resource; action: keyof Permission };
}

/** Redirect to dashboard when the user lacks required role or permission. */
export function ProtectedRoute({
  children,
  roles,
  permission,
}: ProtectedRouteProps) {
  const { hasAnyRole, hasPermission } = usePermissions();

  if (roles?.length && !hasAnyRole(roles)) {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(permission.resource, permission.action)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
