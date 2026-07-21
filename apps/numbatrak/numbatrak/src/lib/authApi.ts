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

  // Better Auth's own auto-mounted organization endpoint - not a custom route.
  listMembers: () => apiRequest<{ members: OrgMember[] }>("/api/auth/organization/get-members", { method: "GET" }),
};
