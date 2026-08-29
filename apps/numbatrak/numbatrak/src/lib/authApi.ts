import { apiRequest } from "./apiClient";

/**
 * Mirrors apps/api's @platform/shared-types shapes locally rather than
 * depending on that package - Numbatrak has its own standalone
 * pnpm-workspace.yaml and isn't a member of the root workspace, so it can't
 * resolve `@platform/*` packages. Keep in sync with
 * packages/shared-types/src/auth.ts by hand.
 */
export type OrgRole = "owner" | "admin" | "editor" | "viewer" | "manager" | "csr";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
}

export interface UserOrganizationMembership {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

export interface MeResponse {
  user: AuthUser;
  organizations: UserOrganizationMembership[];
  activeOrganizationId: string | null;
}

export type LoginResponse =
  | { twoFactorRedirect: true; twoFactorMethods: string[] }
  | { token: string; user: AuthUser };

export interface RegisterRequest {
  email: string;
  password: string;
  businessName: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrgRole;
  createdAt: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  organizationId: string;
  inviterId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserInvitation extends Invitation {
  organizationName: string;
}

/** Auth params (path/body/query shapes) are Better Auth's own organization
 * plugin surface, auto-mounted at /api/auth/organization/* - not custom
 * routes. See apps/api/src/lib/auth.ts's `organization()` plugin config. */
export const authApi = {
  me: () => apiRequest<MeResponse>("/auth/me", { method: "GET" }),

  login: (email: string, password: string) =>
    apiRequest<LoginResponse>("/auth/login", { method: "POST", body: { email, password } }),

  register: (body: RegisterRequest) =>
    apiRequest<{ message: string }>("/auth/register", { method: "POST", body }),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),

  setActiveOrganization: (organizationId: string) =>
    apiRequest<{ id: string }>("/api/auth/organization/set-active", {
      method: "POST",
      body: { organizationId },
    }),

  listMembers: (organizationId?: string) =>
    apiRequest<{ members: OrgMember[]; total: number }>(
      `/api/auth/organization/list-members${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`,
      { method: "GET" },
    ),

  updateMemberRole: (memberId: string, organizationId: string, role: OrgRole) =>
    apiRequest<{ member: OrgMember }>("/api/auth/organization/update-member-role", {
      method: "POST",
      body: { memberId, organizationId, role },
    }),

  removeMember: (memberIdOrEmail: string, organizationId: string) =>
    apiRequest<{ member: OrgMember }>("/api/auth/organization/remove-member", {
      method: "POST",
      body: { memberIdOrEmail, organizationId },
    }),

  createOrganization: (body: { name: string; slug: string; metadata?: Record<string, unknown> }) =>
    apiRequest<OrgRecord>("/api/auth/organization/create", { method: "POST", body }),

  updateOrganization: (
    organizationId: string,
    data: { name?: string; slug?: string; logo?: string | null; metadata?: Record<string, unknown> },
  ) =>
    apiRequest<OrgRecord>("/api/auth/organization/update", {
      method: "POST",
      body: { organizationId, data },
    }),

  inviteMember: (body: { email: string; role: OrgRole; organizationId: string; resend?: boolean }) =>
    apiRequest<Invitation>("/api/auth/organization/invite-member", { method: "POST", body }),

  cancelInvitation: (invitationId: string) =>
    apiRequest<Invitation>("/api/auth/organization/cancel-invitation", {
      method: "POST",
      body: { invitationId },
    }),

  acceptInvitation: (invitationId: string) =>
    apiRequest<{ invitation: Invitation; member: OrgMember }>("/api/auth/organization/accept-invitation", {
      method: "POST",
      body: { invitationId },
    }),

  listInvitations: (organizationId: string) =>
    apiRequest<Invitation[]>(
      `/api/auth/organization/list-invitations?organizationId=${encodeURIComponent(organizationId)}`,
      { method: "GET" },
    ),

  listUserInvitations: () =>
    apiRequest<UserInvitation[]>("/api/auth/organization/list-user-invitations", { method: "GET" }),
};
