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
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view"],
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
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view"],
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
  members: ["invite", "remove", "manage_roles"],
  settings: ["manage"],
  payments: ["manage"],
  orders: ["view"],
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
 * org/member-management resources either.
 */
export const editorRole = ac.newRole({
  site: ["edit"],
  products: ["edit", "view"],
});

/** Viewer gets every `*.view` action across all statements. */
export const viewerRole = ac.newRole({
  billing: ["view"],
  products: ["view"],
  orders: ["view"],
});

export const orgRoles = {
  owner: ownerRole,
  admin: adminRole,
  editor: editorRole,
  viewer: viewerRole,
};
