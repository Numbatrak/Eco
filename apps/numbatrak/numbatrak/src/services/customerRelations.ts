import { authApi } from "../lib/authApi";
import { UserProfile } from "../types/user";

/**
 * Fetch Customer Relations (csr-role) users in the current organization.
 * Reuses Better Auth's own org-members endpoint (no Numbatrak-specific
 * backend route needed) rather than a user_profiles table lookup.
 */
export async function fetchCustomerRelationsUsers(
  organizationId: string | null
): Promise<UserProfile[]> {
  if (!organizationId) return [];

  const { members } = await authApi.listMembers();
  return members
    .filter((m) => m.role === "csr")
    .map((m) => ({
      id: m.user.id,
      email: m.user.email || null,
      full_name: m.user.name ?? null,
      role: "Customer Relations",
      email_verified: true,
      created_at: m.createdAt || null,
      updated_at: null,
    }));
}
