export type PermissionKey = "products.view" | "products.edit" | "payments.manage" | "orders.view";

export type TenantMemberRole = "owner" | "admin" | "member";

/**
 * Default permission grant per role, applied once at tenant_member creation
 * time. There's no per-member override UI in this task's scope - permissions
 * live on tenant_member_permissions (not derived live from role) so that
 * door is open later without a schema change.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<TenantMemberRole, PermissionKey[]> = {
  owner: ["products.view", "products.edit", "payments.manage", "orders.view"],
  admin: ["products.view", "products.edit", "payments.manage", "orders.view"],
  member: ["products.view"],
};
