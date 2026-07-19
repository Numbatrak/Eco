import type { LoginResponse, PlatformAdminLoginRequest } from "@platform/shared-types";
import { apiRequest } from "../../lib/apiClient";

export interface PlatformAdminSessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
}

export interface GetSessionResponse {
  session: { id: string; expiresAt: string; token: string; userId: string };
  user: PlatformAdminSessionUser;
}

export interface TwoFactorVerifyResponse {
  token: string;
  user: PlatformAdminSessionUser;
}

/**
 * Talks to the isolated platform-admin Better Auth instance
 * (basePath /platform-admin/auth, cookiePrefix platform_admin) - never the
 * tenant-member /auth/* endpoints. There is no custom "me" endpoint here
 * (unlike apps/admin/src/lib/authApi.ts's /auth/me), so session recovery
 * calls Better Auth's own get-session endpoint directly.
 */
export const platformAdminAuthApi = {
  login: (body: PlatformAdminLoginRequest) =>
    apiRequest<LoginResponse>("/platform-admin/login", { method: "POST", body }),

  getSession: () =>
    apiRequest<GetSessionResponse | null>("/platform-admin/auth/get-session", { method: "GET" }),

  logout: () => apiRequest<void>("/platform-admin/auth/sign-out", { method: "POST" }),

  verifyTotp: (code: string) =>
    apiRequest<TwoFactorVerifyResponse>("/platform-admin/auth/two-factor/verify-totp", {
      method: "POST",
      body: { code },
    }),

  verifyBackupCode: (code: string) =>
    apiRequest<TwoFactorVerifyResponse>("/platform-admin/auth/two-factor/verify-backup-code", {
      method: "POST",
      body: { code },
    }),
};
