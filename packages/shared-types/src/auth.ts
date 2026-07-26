import { z } from "zod";

// Optional signup attribution — captured client-side and persisted onto the
// organization, the join key for the Super Admin Overview's acquisition-channel
// metrics and affiliate commission. All optional so signup never depends on them.
export const signupAttributionSchema = z.object({
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
  landingPath: z.string().max(500).optional(),
});
export type SignupAttribution = z.infer<typeof signupAttributionSchema>;

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  businessName: z.string().trim().min(1).max(200),
  attribution: signupAttributionSchema.optional(),
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

// `manager`/`csr` back Numbatrak's role model (Manager/Customer Relations) -
// see packages/db/src/schema/numbatrak/ and apps/api/src/lib/access-control.ts.
export const orgRoleSchema = z.enum(["owner", "admin", "editor", "viewer", "manager", "csr"]);
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
