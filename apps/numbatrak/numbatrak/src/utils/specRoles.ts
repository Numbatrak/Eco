import type { UserRole } from "../types/user";

/**
 * Spec six-role model (HR suite) vs current org membership roles.
 * Use these helpers until Staff Management ships with multi-role union.
 */

export type SpecRole =
  | "CRS"
  | "Manager"
  | "Admin"
  | "Media"
  | "Accountant"
  | "Founder";

/** Map current app role → spec role name for docs and future HR alignment. */
export const APP_ROLE_TO_SPEC: Record<UserRole, SpecRole> = {
  "Customer Relations": "CRS",
  Manager: "Manager",
  Admin: "Admin",
  Owner: "Founder",
};

/** Inverse: spec role → current app roles that satisfy it today. */
export const SPEC_TO_APP_ROLES: Record<SpecRole, UserRole[]> = {
  CRS: ["Customer Relations"],
  Manager: ["Manager"],
  Admin: ["Admin"],
  Media: ["Admin", "Owner"],
  Accountant: ["Admin", "Owner"],
  Founder: ["Owner"],
};

export type DataScope = "own" | "team" | "org_money" | "org_all";

/**
 * Spec data scope for orders, dashboard money metrics, and follow-ups.
 * - CRS: own rows only
 * - Manager: team (org-wide orders until team hierarchy exists)
 * - Admin/Founder: all including money
 */
export function orderDataScope(role: UserRole | null): DataScope {
  if (!role) return "own";
  switch (role) {
    case "Customer Relations":
      return "own";
    case "Manager":
      return "team";
    case "Admin":
    case "Owner":
      return "org_money";
    default:
      return "own";
  }
}

/** True when role may view wallet, accounting placeholders, and full dashboard money KPIs. */
export function canViewOrgMoney(role: UserRole | null): boolean {
  return role === "Owner" || role === "Admin" || role === "Manager";
}

/** CSR filter: when scope is own, pass current user id; otherwise null (no filter). */
export function csrScopeFilter(
  role: UserRole | null,
  userId: string | null | undefined
): string | null {
  if (orderDataScope(role) === "own" && userId) {
    return userId;
  }
  return null;
}

export function specRoleLabel(role: UserRole | null): SpecRole | null {
  if (!role) return null;
  return APP_ROLE_TO_SPEC[role] ?? null;
}

/** Nav/feature gates that reference spec-only roles not yet in membership. */
export const SPEC_ROLE_NOT_YET_IN_APP: SpecRole[] = ["Media", "Accountant"];
