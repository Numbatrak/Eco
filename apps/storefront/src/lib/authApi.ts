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
};
