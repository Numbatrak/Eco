import { createAccessControl } from "better-auth/plugins/access";

/**
 * Permission matrix for the organization plugin. Two kinds of resources are
 * mixed in here:
 *
 * - Product-spec resources (billing/site/products/settings/payments,
 *   +orders - see below) gate this app's own routes via requireOrgPermission.
 * - Better Auth's own built-in resources (organization/member/invitation/
 *   team/ac) are what the plugin's *internal* handlers check against for
 *   its own actions (removeMember, updateMemberRole, invitations, org
 *   update/delete, dynamic-role management) - they are NOT optional to
 *   define. Passing a custom `roles` option replaces the plugin's defaults
 *   entirely rather than extending them, so a role that omits e.g.
 *   `member: ["delete"]` genuinely cannot remove a member, regardless of
 *   what the custom `members` statement below says - confirmed by
 *   integration testing (auth.api.removeMember rejected with
 *   YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER for every custom role until
 *   these were added).
 *
 * `orders` isn't in the original product spec - it's added here so the
 * existing order-list/detail routes keep the same gating they had under the
 * old system (only owner/admin could view orders there).
 */
const statement = {
  billing: ["manage", "view"],
  site: ["edit", "publish"],
  products: ["edit", "view"],
  collections: ["edit", "view"],
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view", "manage"],
  // Numbatrak domain resources (packages/db/src/schema/numbatrak/). Added
  // incrementally, one per ported feature slice.
  numbatrakAgents: ["view", "manage"],
  // Distinct from the storefront's own `products` resource above - a
  // different table/domain entirely. Source app's own matrix gives CSR
  // view-only (unlike numbatrakOrders, CSR gets no create/update/delete here).
  numbatrakProducts: ["view", "create", "update", "delete"],
  // Finer-grained than "view"/"manage" deliberately: the source app's own
  // permission matrix gives CSR create+update but explicitly NOT delete, so
  // a single "manage" bucket would over-grant delete to csr.
  numbatrakOrders: ["view", "create", "update", "delete"],
  // Deliveries/Waybills - CSR is fully read-only here (unlike numbatrakOrders,
  // which grants CSR create+update).
  numbatrakDeliveries: ["view", "create", "update", "delete"],
  // Wallet has no view-only tier in the source app - CSR gets nothing at all
  // (not even view), the one resource where that's true.
  numbatrakWallet: ["view", "manage"],
  numbatrakExpenses: ["view", "create", "update", "delete"],
  // Source app reuses the "orders" resource for follow-ups - same shape here.
  numbatrakFollowUps: ["view", "create", "update", "delete"],
  // Every role (including csr) can view the dashboard - csr just sees a
  // cut-down version (no money tiles) via client-side UI gating, mirroring
  // the source app's own role-based section visibility, not a resource-level
  // access difference like numbatrakWallet has.
  numbatrakDashboard: ["view"],
  // CSR gets view-only, like numbatrakProducts (not numbatrakOrders' create+update grant).
  numbatrakForms: ["view", "create", "update", "delete"],
  // Per the Feature Spec's confirmed decision: "Both CRS and manager can
  // manage stock numbers, transfers, and adjustments... self-service, not
  // admin-only" - one of the few Numbatrak resources where csr gets "manage",
  // not just view.
  numbatrakInventory: ["view", "manage"],
  // Staff (HR/team roster) - view-only vs manage split matters here: bank
  // details and role assignment are sensitive, so "manage" is deliberately
  // narrower than the other resources' owner/admin/manager-all-get-CRUD
  // pattern (see managerRole/csrRole below - csr is row-scoped to their own
  // record, not resource-gated here at all).
  numbatrakStaff: ["view", "manage"],
  // Better Auth's own built-in resources - see note above.
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const ownerRole = ac.newRole({
  billing: ["manage", "view"],
  site: ["edit", "publish"],
  products: ["edit", "view"],
  collections: ["edit", "view"],
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view", "manage"],
  numbatrakAgents: ["view", "manage"],
  numbatrakProducts: ["view", "create", "update", "delete"],
  numbatrakOrders: ["view", "create", "update", "delete"],
  numbatrakDeliveries: ["view", "create", "update", "delete"],
  numbatrakWallet: ["view", "manage"],
  numbatrakExpenses: ["view", "create", "update", "delete"],
  numbatrakFollowUps: ["view", "create", "update", "delete"],
  numbatrakDashboard: ["view"],
  numbatrakForms: ["view", "create", "update", "delete"],
  numbatrakInventory: ["view", "manage"],
  numbatrakStaff: ["view", "manage"],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
});

export const adminRole = ac.newRole({
  billing: ["view"],
  site: ["edit", "publish"],
  products: ["edit", "view"],
  collections: ["edit", "view"],
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view", "manage"],
  numbatrakAgents: ["view", "manage"],
  numbatrakProducts: ["view", "create", "update", "delete"],
  numbatrakOrders: ["view", "create", "update", "delete"],
  numbatrakDeliveries: ["view", "create", "update", "delete"],
  numbatrakWallet: ["view", "manage"],
  numbatrakExpenses: ["view", "create", "update", "delete"],
  numbatrakFollowUps: ["view", "create", "update", "delete"],
  numbatrakDashboard: ["view"],
  numbatrakForms: ["view", "create", "update", "delete"],
  numbatrakInventory: ["view", "manage"],
  numbatrakStaff: ["view", "manage"],
  // Can manage members/invitations same as owner, but not delete/rename the
  // organization itself or touch dynamic access-control roles - mirrors
  // admin missing billing.manage: broad day-to-day power, not ownership-level.
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
});

/**
 * Editor's grant list is closed/explicit per the product spec - unlike
 * viewer, it does NOT expand to include every `*.view` action, so it does
 * not get `orders.view` (nor `billing.view`), and has none of the
 * org/member-management resources either. Storefront-only role - no
 * Numbatrak grants (a Numbatrak-only business assigns owner/admin/manager/csr
 * to its team instead, never editor/viewer).
 */
export const editorRole = ac.newRole({
  site: ["edit"],
  products: ["edit", "view"],
  collections: ["edit", "view"],
});

/**
 * Viewer gets every `*.view` action across all statements. Storefront-only
 * role - see editorRole's note; no Numbatrak grants.
 */
export const viewerRole = ac.newRole({
  billing: ["view"],
  products: ["view"],
  collections: ["view"],
  orders: ["view"],
});

/**
 * Numbatrak's "Manager" - team/operational access, no billing/org/member
 * management. No storefront grants (Numbatrak-specific role), same shape as
 * editorRole in that respect.
 */
export const managerRole = ac.newRole({
  numbatrakAgents: ["view", "manage"],
  numbatrakProducts: ["view", "create", "update", "delete"],
  numbatrakOrders: ["view", "create", "update", "delete"],
  numbatrakDeliveries: ["view", "create", "update", "delete"],
  numbatrakWallet: ["view", "manage"],
  numbatrakExpenses: ["view", "create", "update", "delete"],
  numbatrakFollowUps: ["view", "create", "update", "delete"],
  numbatrakDashboard: ["view"],
  numbatrakForms: ["view", "create", "update", "delete"],
  numbatrakInventory: ["view", "manage"],
  numbatrakStaff: ["view", "manage"],
});

/**
 * Numbatrak's "Customer Relations" - per the source app's own permission
 * matrix (utils/permissions.ts), CSR can view+create+update orders but
 * explicitly NOT delete - unlike numbatrakAgents/numbatrakOrders' other
 * roles, deliberately omits "delete" here rather than granting it via a
 * catch-all bucket. Row-level "own orders only" scoping (a CSR only sees
 * orders assigned to them) is enforced in the list route
 * (lib/orders.ts's csrScopeUserId param), not by this statement - this only
 * gates the resource/actions, not which rows.
 */
export const csrRole = ac.newRole({
  numbatrakAgents: ["view"],
  numbatrakProducts: ["view"],
  numbatrakOrders: ["view", "create", "update"],
  numbatrakDeliveries: ["view"],
  numbatrakExpenses: ["view"],
  // CSR gets create+update but not delete here too, mirroring numbatrakOrders
  // (the source app literally reuses the "orders" resource for follow-ups).
  numbatrakFollowUps: ["view", "create", "update"],
  numbatrakDashboard: ["view"],
  numbatrakForms: ["view"],
  // Unlike most other csr grants here, this IS "manage" not "view" - the
  // Feature Spec explicitly gives csr stock transfer/adjust rights, same as
  // manager (see the statement's own comment above).
  numbatrakInventory: ["view", "manage"],
  // View-only, row-scoped to their own record by the list route (same
  // pattern as numbatrakOrders' csrScopeUserId) - a csr can see but not edit
  // their own HR/bank details.
  numbatrakStaff: ["view"],
  // numbatrakWallet intentionally omitted - csr gets zero wallet access, not even view.
});

export const orgRoles = {
  owner: ownerRole,
  admin: adminRole,
  editor: editorRole,
  viewer: viewerRole,
  manager: managerRole,
  csr: csrRole,
};
