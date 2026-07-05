import type {
  RegisterRequest,
  MessageResponse,
  LoginRequest,
  LoginResponse,
  AccessTokenResponse,
  MfaVerifyRequest,
  MfaSendEmailOtpRequest,
  TotpSetupResponse,
  TotpConfirmRequest,
  TotpConfirmResponse,
  EmailOtpConfirmRequest,
  MfaDisableRequest,
  BackupCodesRegenerateRequest,
  BackupCodesRegenerateResponse,
  MfaStatusResponse,
  PasswordResetRequest,
  PasswordResetComplete,
  VerifyEmailRequest,
  MeResponse,
} from "@platform/shared-types";
import { apiRequest } from "./apiClient";

export const authApi = {
  me: (accessToken: string) => apiRequest<MeResponse>("/auth/me", { method: "GET", accessToken }),

  register: (body: RegisterRequest) =>
    apiRequest<MessageResponse>("/auth/register", { method: "POST", body }),

  login: (body: LoginRequest) => apiRequest<LoginResponse>("/auth/login", { method: "POST", body }),

  refresh: () => apiRequest<AccessTokenResponse>("/auth/refresh", { method: "POST" }),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),

  logoutAll: (accessToken: string) =>
    apiRequest<void>("/auth/logout-all", { method: "POST", accessToken }),

  verifyEmail: (body: VerifyEmailRequest) =>
    apiRequest<void>("/auth/verify-email", { method: "POST", body }),

  requestPasswordReset: (body: PasswordResetRequest) =>
    apiRequest<MessageResponse>("/auth/password-reset/request", { method: "POST", body }),

  completePasswordReset: (body: PasswordResetComplete) =>
    apiRequest<void>("/auth/password-reset/complete", { method: "POST", body }),

  mfaVerify: (body: MfaVerifyRequest) =>
    apiRequest<AccessTokenResponse>("/auth/2fa/verify", { method: "POST", body }),

  mfaSendEmailOtp: (body: MfaSendEmailOtpRequest) =>
    apiRequest<MessageResponse>("/auth/2fa/send-email-otp", { method: "POST", body }),

  mfaStatus: (accessToken: string) =>
    apiRequest<MfaStatusResponse>("/auth/2fa/status", { method: "GET", accessToken }),

  totpSetup: (accessToken: string) =>
    apiRequest<TotpSetupResponse>("/auth/2fa/totp/setup", { method: "POST", accessToken }),

  totpConfirm: (accessToken: string, body: TotpConfirmRequest) =>
    apiRequest<TotpConfirmResponse>("/auth/2fa/totp/confirm", {
      method: "POST",
      accessToken,
      body,
    }),

  emailOtpSetup: (accessToken: string) =>
    apiRequest<MessageResponse>("/auth/2fa/email-otp/setup", { method: "POST", accessToken }),

  emailOtpConfirm: (accessToken: string, body: EmailOtpConfirmRequest) =>
    apiRequest<void>("/auth/2fa/email-otp/confirm", { method: "POST", accessToken, body }),

  mfaDisable: (accessToken: string, body: MfaDisableRequest) =>
    apiRequest<void>("/auth/2fa/disable", { method: "POST", accessToken, body }),

  backupCodesRegenerate: (accessToken: string, body: BackupCodesRegenerateRequest) =>
    apiRequest<BackupCodesRegenerateResponse>("/auth/2fa/backup-codes/regenerate", {
      method: "POST",
      accessToken,
      body,
    }),
};
