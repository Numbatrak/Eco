"use client";

import type {
  RegisterRequest,
  MessageResponse,
  LoginRequest,
  LoginResponse,
  PasswordResetRequest,
  PasswordResetComplete,
  MeResponse,
} from "@platform/shared-types";
import { apiRequest } from "./apiClient";

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

export interface OrgInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
}

export interface EnableTwoFactorResponse {
  totpURI: string;
  backupCodes: string[];
}

export interface GenerateBackupCodesResponse {
  status: boolean;
  backupCodes: string[];
}

export interface TwoFactorSignInResponse {
  token: string;
  user: MeResponse["user"];
}

export const authApi = {
  me: () => apiRequest<MeResponse>("/auth/me", { method: "GET" }),

  register: (body: RegisterRequest) =>
    apiRequest<MessageResponse>("/auth/register", { method: "POST", body }),

  login: (body: LoginRequest) => apiRequest<LoginResponse>("/auth/login", { method: "POST", body }),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),

  logoutAll: () => apiRequest<void>("/auth/logout-all", { method: "POST" }),

  requestPasswordReset: (body: PasswordResetRequest) =>
    apiRequest<MessageResponse>("/auth/password-reset/request", { method: "POST", body }),

  completePasswordReset: (body: PasswordResetComplete) =>
    apiRequest<void>("/auth/password-reset/complete", { method: "POST", body }),

  // --- Better Auth's own auto-mounted two-factor routes (/api/auth/two-factor/*) ---
  // Enrollment (settings page, already-authenticated session):
  enableTwoFactor: (password: string) =>
    apiRequest<EnableTwoFactorResponse>("/api/auth/two-factor/enable", {
      method: "POST",
      body: { password },
    }),

  disableTwoFactor: (password: string) =>
    apiRequest<{ status: boolean }>("/api/auth/two-factor/disable", {
      method: "POST",
      body: { password },
    }),

  generateBackupCodes: (password: string) =>
    apiRequest<GenerateBackupCodesResponse>("/api/auth/two-factor/generate-backup-codes", {
      method: "POST",
      body: { password },
    }),

  verifyTotp: (code: string) =>
    apiRequest<TwoFactorSignInResponse>("/api/auth/two-factor/verify-totp", {
      method: "POST",
      body: { code },
    }),

  verifyOtp: (code: string) =>
    apiRequest<TwoFactorSignInResponse>("/api/auth/two-factor/verify-otp", {
      method: "POST",
      body: { code },
    }),

  verifyBackupCode: (code: string) =>
    apiRequest<TwoFactorSignInResponse>("/api/auth/two-factor/verify-backup-code", {
      method: "POST",
      body: { code },
    }),

  sendOtp: () => apiRequest<{ status: boolean }>("/api/auth/two-factor/send-otp", { method: "POST" }),

  // --- Better Auth organization endpoints ---
  setActiveOrganization: (organizationId: string) =>
    apiRequest<{ id: string }>("/api/auth/organization/set-active", {
      method: "POST",
      body: { organizationId },
    }),

  createOrganization: (name: string, slug: string) =>
    apiRequest<{ id: string; name: string; slug: string }>("/api/auth/organization/create", {
      method: "POST",
      body: { name, slug },
    }),

  // --- Team management ---
  listMembers: (organizationId: string) =>
    apiRequest<{ members: OrgMember[] }>("/api/auth/organization/get-members", {
      method: "GET",
    }),

  listInvitations: () =>
    apiRequest<{ invitations: OrgInvitation[] }>("/api/auth/organization/list-invitations", {
      method: "GET",
    }),

  inviteMember: (email: string, role: string, organizationId: string) =>
    apiRequest<unknown>("/api/auth/organization/invite-member", {
      method: "POST",
      body: { email, role, organizationId },
    }),

  cancelInvitation: (invitationId: string) =>
    apiRequest<unknown>("/api/auth/organization/cancel-invitation", {
      method: "POST",
      body: { invitationId },
    }),

  acceptInvitation: (invitationId: string) =>
    apiRequest<unknown>("/api/auth/organization/accept-invitation", {
      method: "POST",
      body: { invitationId },
    }),

  rejectInvitation: (invitationId: string) =>
    apiRequest<unknown>("/api/auth/organization/reject-invitation", {
      method: "POST",
      body: { invitationId },
    }),

  getInvitation: (invitationId: string) =>
    apiRequest<OrgInvitation>(`/api/auth/organization/get-invitation?id=${encodeURIComponent(invitationId)}`, {
      method: "GET",
    }),

  removeMember: (memberIdOrEmail: string, organizationId: string) =>
    apiRequest<unknown>("/api/auth/organization/remove-member", {
      method: "POST",
      body: { memberIdOrEmail, organizationId },
    }),

  updateMemberRole: (memberId: string, role: string, organizationId: string) =>
    apiRequest<unknown>("/api/auth/organization/update-member-role", {
      method: "POST",
      body: { memberId, role, organizationId },
    }),
};
