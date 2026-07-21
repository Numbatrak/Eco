import type { OrganizationWithRole } from "../types/organization";

const LEGACY_KEY = "currentOrganizationId";
const keyForUser = (userId: string) => `numbatrak:defaultOrgId:${userId}`;

/** Read persisted default org id for a user (migrates legacy global key once). */
export function getDefaultOrganizationId(userId: string): string | null {
  const scoped = localStorage.getItem(keyForUser(userId));
  if (scoped) return scoped;

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    localStorage.setItem(keyForUser(userId), legacy);
    localStorage.removeItem(LEGACY_KEY);
    return legacy;
  }

  return null;
}

export function setDefaultOrganizationId(
  userId: string,
  organizationId: string
): void {
  localStorage.setItem(keyForUser(userId), organizationId);
}

export function clearDefaultOrganizationId(userId: string): void {
  localStorage.removeItem(keyForUser(userId));
}

/** Pick saved default, keep current if still valid, else first org. */
export function resolveOrganization(
  orgs: OrganizationWithRole[],
  userId: string,
  current: OrganizationWithRole | null
): OrganizationWithRole | null {
  if (!orgs.length) return null;

  if (current) {
    const stillMember = orgs.find((org) => org.id === current.id);
    if (stillMember) {
      return stillMember.name !== current.name || stillMember.role !== current.role
        ? stillMember
        : current;
    }
  }

  const savedId = getDefaultOrganizationId(userId);
  if (savedId) {
    const saved = orgs.find((org) => org.id === savedId);
    if (saved) return saved;
  }

  return orgs[0];
}

export function isDefaultOrganization(
  userId: string | undefined,
  organizationId: string
): boolean {
  if (!userId) return false;
  return getDefaultOrganizationId(userId) === organizationId;
}
