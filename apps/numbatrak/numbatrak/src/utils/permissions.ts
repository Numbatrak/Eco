import { UserRole, RolePermissions, Permission } from "../types/user";

/**
 * Define permissions for each role
 */
const rolePermissions: Record<UserRole, RolePermissions> = {
  Owner: {
    agents: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    products: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    deliveries: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    orders: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    expenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    generalExpenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    inventory: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    forms: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    users: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
  },
  Admin: {
    agents: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    products: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    deliveries: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    orders: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    expenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    generalExpenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    inventory: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    forms: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    users: { canView: true, canCreate: false, canUpdate: false, canDelete: false }, // Cannot manage user roles
  },
  Manager: {
    agents: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    products: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    deliveries: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    orders: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    expenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    generalExpenses: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    inventory: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    forms: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    users: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
  "Customer Relations": {
    agents: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    products: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    deliveries: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    orders: { canView: true, canCreate: true, canUpdate: true, canDelete: false }, // Can create orders and update order status/notes
    expenses: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    generalExpenses: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    inventory: { canView: true, canCreate: true, canUpdate: false, canDelete: false }, // Can add inventory
    forms: { canView: true, canCreate: false, canUpdate: false, canDelete: false }, // Read-only access to forms
    users: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
};

/**
 * Get permissions for a specific role
 */
export function getPermissions(role: UserRole | null): RolePermissions | null {
  if (!role) return null;
  return rolePermissions[role];
}

/**
 * Check if user has permission for a specific resource and action
 */
export function hasPermission(
  role: UserRole | null,
  resource: keyof RolePermissions,
  action: keyof Permission
): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions[resource]?.[action] ?? false;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRole: UserRole | null, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: UserRole | null, requiredRole: UserRole): boolean {
  return userRole === requiredRole;
}

/**
 * Check if user can manage users (only Owner)
 */
export function canManageUsers(role: UserRole | null): boolean {
  return role === "Owner";
}

/**
 * Check if user can manage a specific resource
 */
export function canManageResource(
  role: UserRole | null,
  resource: keyof RolePermissions
): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  const resourcePerms = permissions[resource];
  return resourcePerms?.canCreate || resourcePerms?.canUpdate || resourcePerms?.canDelete || false;
}








