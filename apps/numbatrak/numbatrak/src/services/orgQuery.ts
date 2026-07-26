/** Returns empty list when org context is missing (never query all orgs from UI). */
export function emptyWithoutOrg<T>(organizationId: string | null | undefined): T[] | null {
  return organizationId ? null : [];
}
