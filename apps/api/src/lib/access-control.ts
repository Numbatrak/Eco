import { createAccessControl } from "better-auth/plugins/access";
import type { NumbatrakSpecRole } from "@platform/shared-types";

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
  numbatrakPayroll: ["view", "manage"],
  numbatrakAttendance: ["view", "manage"],
  numbatrakStrikes: ["view", "manage"],
  numbatrakStars: ["view", "manage"],
  numbatrakLeave: ["view", "manage"],
  numbatrakOrderAssignment: ["view", "manage"],
  numbatrakMediaBuyers: ["view", "manage"],
  numbatrakCrm: ["view", "manage"],
  // Per-location delivery-fee rules Order Forms reads from (spec §15's
  // "location can drive the delivery fee, tying to the delivery configuration").
  numbatrakDeliveryFees: ["view", "manage"],
  // Better Auth's own built-in resources - see note above.
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

/**
 * Numbatrak-only slice of each app role's grants, extracted so the extraRoles
 * access-union (numbatrak-staff/lib/staff.ts's resolveExtraRoleGrants) has a
 * single source of truth to read from instead of re-deriving these from the
 * full ac.newRole() objects (whose internal shape belongs to better-auth, not
 * us). Spread into the actual role definitions below so there's no risk of
 * the two drifting apart.
 */
export const OWNER_NUMBATRAK_GRANTS = {
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
  numbatrakPayroll: ["view", "manage"],
  numbatrakAttendance: ["view", "manage"],
  numbatrakStrikes: ["view", "manage"],
  numbatrakStars: ["view", "manage"],
  numbatrakLeave: ["view", "manage"],
  numbatrakOrderAssignment: ["view", "manage"],
  numbatrakMediaBuyers: ["view", "manage"],
  numbatrakCrm: ["view", "manage"],
  numbatrakDeliveryFees: ["view", "manage"],
} as const;

export const ADMIN_NUMBATRAK_GRANTS = OWNER_NUMBATRAK_GRANTS;

export const MANAGER_NUMBATRAK_GRANTS = {
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
  numbatrakPayroll: ["view", "manage"],
  numbatrakAttendance: ["view", "manage"],
  numbatrakStrikes: ["view", "manage"],
  numbatrakStars: ["view", "manage"],
  numbatrakLeave: ["view", "manage"],
  numbatrakOrderAssignment: ["view", "manage"],
  numbatrakMediaBuyers: ["view", "manage"],
  numbatrakCrm: ["view", "manage"],
  numbatrakDeliveryFees: ["view", "manage"],
} as const;

export const CSR_NUMBATRAK_GRANTS = {
  numbatrakAgents: ["view"],
  numbatrakProducts: ["view"],
  numbatrakOrders: ["view", "create", "update"],
  numbatrakDeliveries: ["view"],
  numbatrakExpenses: ["view"],
  numbatrakFollowUps: ["view", "create", "update"],
  numbatrakDashboard: ["view"],
  numbatrakForms: ["view"],
  numbatrakInventory: ["view", "manage"],
  numbatrakStaff: ["view"],
  numbatrakPayroll: ["view"],
  numbatrakAttendance: ["view"],
  numbatrakStrikes: ["view"],
  numbatrakStars: ["view"],
  numbatrakLeave: ["view"],
  numbatrakOrderAssignment: ["view"],
  numbatrakMediaBuyers: ["view"],
  numbatrakCrm: ["view"],
  numbatrakDeliveryFees: ["view"],
} as const;

export const ownerRole = ac.newRole({
  billing: ["manage", "view"],
  site: ["edit", "publish"],
  products: ["edit", "view"],
  collections: ["edit", "view"],
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view", "manage"],
  ...OWNER_NUMBATRAK_GRANTS,
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
  ...ADMIN_NUMBATRAK_GRANTS,
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
export const managerRole = ac.newRole({ ...MANAGER_NUMBATRAK_GRANTS });

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
export const csrRole = ac.newRole({ ...CSR_NUMBATRAK_GRANTS });

export const orgRoles = {
  owner: ownerRole,
  admin: adminRole,
  editor: editorRole,
  viewer: viewerRole,
  manager: managerRole,
  csr: csrRole,
};

/**
 * What each six-role spec vocabulary role grants on Numbatrak resources when
 * HELD AS AN EXTRA ROLE (numbatrakStaff.extraRoles) - "access is the union of
 * all roles held" (LOCKED RULE). Media/Accountant have no dedicated
 * member.role today (see NUMBATRAK_SPEC_ROLE_COMPATIBLE_MEMBER_ROLES in
 * shared-types), so they contribute admin-level grants, matching that same
 * compatibility mapping.
 */
export const SPEC_ROLE_NUMBATRAK_GRANTS: Record<NumbatrakSpecRole, Record<string, readonly string[]>> = {
  CRS: CSR_NUMBATRAK_GRANTS,
  Manager: MANAGER_NUMBATRAK_GRANTS,
  Admin: ADMIN_NUMBATRAK_GRANTS,
  Founder: OWNER_NUMBATRAK_GRANTS,
  Media: ADMIN_NUMBATRAK_GRANTS,
  Accountant: ADMIN_NUMBATRAK_GRANTS,
};

/** True if `grants` covers every requested action on every requested resource. */
export function grantsSatisfyPermissions(
  grants: Record<string, readonly string[]>,
  requested: Record<string, string[]>,
): boolean {
  return Object.entries(requested).every(([resource, actions]) => {
    const granted = grants[resource];
    if (!granted) return false;
    return actions.every((action) => granted.includes(action));
  });
}

/** Union of every held spec role's numbatrak grants - additive by construction (Set union per resource). */
export function unionNumbatrakGrants(roles: NumbatrakSpecRole[]): Record<string, readonly string[]> {
  const merged: Record<string, Set<string>> = {};
  for (const role of roles) {
    const grants = SPEC_ROLE_NUMBATRAK_GRANTS[role];
    if (!grants) continue;
    for (const [resource, actions] of Object.entries(grants)) {
      const set = merged[resource] ?? new Set<string>();
      for (const action of actions) set.add(action);
      merged[resource] = set;
    }
  }
  return Object.fromEntries(Object.entries(merged).map(([resource, set]) => [resource, [...set]]));
}
