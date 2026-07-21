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
  // different table/domain entirely. Read-only for now: the backing route
  // is a minimal list-only endpoint (full Products CRUD is a later slice),
  // needed here only so Orders can populate its line-item product picker.
  numbatrakProducts: ["view"],
  // Finer-grained than "view"/"manage" deliberately: the source app's own
  // permission matrix gives CSR create+update but explicitly NOT delete, so
  // a single "manage" bucket would over-grant delete to csr.
  numbatrakOrders: ["view", "create", "update", "delete"],
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
  numbatrakProducts: ["view"],
  numbatrakOrders: ["view", "create", "update", "delete"],
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
  numbatrakProducts: ["view"],
  numbatrakOrders: ["view", "create", "update", "delete"],
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
  numbatrakProducts: ["view"],
  numbatrakOrders: ["view", "create", "update", "delete"],
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
});

export const orgRoles = {
  owner: ownerRole,
  admin: adminRole,
  editor: editorRole,
  viewer: viewerRole,
  manager: managerRole,
  csr: csrRole,
};
