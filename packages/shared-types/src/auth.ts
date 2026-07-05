import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  businessName: z.string().trim().min(1).max(200),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const messageResponseSchema = z.object({
  message: z.string(),
});
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const mfaMethodSchema = z.enum(["totp", "email_otp"]);
export type MfaMethod = z.infer<typeof mfaMethodSchema>;

export const loginResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("authenticated"),
    accessToken: z.string(),
  }),
  z.object({
    status: z.literal("mfa_required"),
    challengeToken: z.string(),
    method: mfaMethodSchema,
  }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const accessTokenResponseSchema = z.object({
  accessToken: z.string(),
});
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;

export const mfaVerifyRequestSchema = z.object({
  challengeToken: z.string(),
  code: z.string().min(1),
});
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

export const mfaSendEmailOtpRequestSchema = z.object({
  challengeToken: z.string(),
});
export type MfaSendEmailOtpRequest = z.infer<typeof mfaSendEmailOtpRequestSchema>;

export const totpSetupResponseSchema = z.object({
  otpauthUrl: z.string(),
  secret: z.string(),
});
export type TotpSetupResponse = z.infer<typeof totpSetupResponseSchema>;

export const mfaCodeSchema = z.object({
  code: z.string().min(1),
});
export type MfaCode = z.infer<typeof mfaCodeSchema>;

export const totpConfirmRequestSchema = mfaCodeSchema;
export type TotpConfirmRequest = z.infer<typeof totpConfirmRequestSchema>;

export const emailOtpConfirmRequestSchema = mfaCodeSchema;
export type EmailOtpConfirmRequest = z.infer<typeof emailOtpConfirmRequestSchema>;

export const totpConfirmResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});
export type TotpConfirmResponse = z.infer<typeof totpConfirmResponseSchema>;

export const mfaDisableRequestSchema = z.object({
  password: z.string(),
  code: z.string().min(1),
});
export type MfaDisableRequest = z.infer<typeof mfaDisableRequestSchema>;

export const backupCodesRegenerateRequestSchema = z.object({
  password: z.string(),
  code: z.string().min(1),
});
export type BackupCodesRegenerateRequest = z.infer<typeof backupCodesRegenerateRequestSchema>;

export const backupCodesRegenerateResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});
export type BackupCodesRegenerateResponse = z.infer<typeof backupCodesRegenerateResponseSchema>;

export const mfaStatusResponseSchema = z.object({
  totpEnabled: z.boolean(),
  emailOtpEnabled: z.boolean(),
  preferredMethod: mfaMethodSchema.nullable(),
  unusedBackupCodeCount: z.number().int().min(0),
});
export type MfaStatusResponse = z.infer<typeof mfaStatusResponseSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetCompleteSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
});
export type PasswordResetComplete = z.infer<typeof passwordResetCompleteSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string(),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const tenantMemberRoleSchema = z.enum(["owner", "admin", "member"]);
export type TenantMemberRoleValue = z.infer<typeof tenantMemberRoleSchema>;

export const userTenantMembershipSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subdomain: z.string().nullable(),
  role: tenantMemberRoleSchema,
});
export type UserTenantMembership = z.infer<typeof userTenantMembershipSchema>;

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  tenants: z.array(userTenantMembershipSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
