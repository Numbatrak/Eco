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

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Matches Better Auth's native sign-in response shape directly (rather than
 * the old custom challengeToken pattern) - the second-factor flow is
 * cookie-based, no token needs to round-trip through the client.
 */
export const loginResponseSchema = z.union([
  z.object({
    twoFactorRedirect: z.literal(true),
    twoFactorMethods: z.array(z.string()),
  }),
  z.object({
    token: z.string(),
    user: authUserSchema,
  }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetCompleteSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
});
export type PasswordResetComplete = z.infer<typeof passwordResetCompleteSchema>;

export const orgRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const userOrganizationMembershipSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: orgRoleSchema,
});
export type UserOrganizationMembership = z.infer<typeof userOrganizationMembershipSchema>;

export const meResponseSchema = z.object({
  user: authUserSchema,
  organizations: z.array(userOrganizationMembershipSchema),
  activeOrganizationId: z.string().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
