"use client";

import { authApi, type Invitation, type UserInvitation } from "../lib/authApi";
import { OrganizationInvitation } from "../types/organization";
import { UserRole } from "../types/user";
import { mapOrgRoleToUserRole, mapUserRoleToOrgRole } from "../utils/roleMapping";

function isExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && new Date(expiresAt) < new Date();
}

function toOrganizationInvitation(
  inv: Invitation,
  organization?: { id: string; name: string }
): OrganizationInvitation {
  return {
    id: inv.id,
    organization_id: inv.organizationId,
    email: inv.email,
    role: mapOrgRoleToUserRole(inv.role),
    invited_by: inv.inviterId,
    status: inv.status as OrganizationInvitation["status"],
    expires_at: inv.expiresAt,
    created_at: inv.createdAt,
    organization,
  };
}

/**
 * Create an invitation to join an organization. apps/api sends the email
 * itself (Better Auth's organization plugin `sendInvitationEmail` hook) -
 * no separate email-sending step needed here.
 */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: UserRole = "Customer Relations"
): Promise<OrganizationInvitation> {
  const inv = await authApi.inviteMember({
    email: email.toLowerCase().trim(),
    role: mapUserRoleToOrgRole(role),
    organizationId,
  });
  return toOrganizationInvitation(inv);
}

/**
 * Accept an invitation using its id (the link apps/api emails out carries
 * this id as ?code=, kept as "code" in the URL for continuity even though
 * it's no longer a separately-generated invitation code).
 */
export async function acceptInvitation(invitationId: string): Promise<{
  success: boolean;
  organization_id?: string;
  role?: string;
  error?: string;
}> {
  try {
    const { invitation, member } = await authApi.acceptInvitation(invitationId);
    return { success: true, organization_id: invitation.organizationId, role: member.role };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to accept invitation",
    };
  }
}

/**
 * Fetch all invitations (any status) for an organization - the settings
 * page's "Invitation History" list.
 */
export async function fetchOrganizationInvitations(
  organizationId: string
): Promise<OrganizationInvitation[]> {
  const invitations = await authApi.listInvitations(organizationId);
  return invitations.map((inv) => toOrganizationInvitation(inv));
}

/**
 * Fetch pending (unexpired) invitations for the current user, by their
 * session email. Better Auth requires a verified email for this endpoint
 * (EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION) - callers already swallow
 * fetch errors into an empty list, so an unverified user just sees none
 * rather than an error, same as before a direct ?code= link is used.
 */
export async function fetchMyPendingInvitations(): Promise<OrganizationInvitation[]> {
  const invitations: UserInvitation[] = await authApi.listUserInvitations();
  return invitations
    .filter((inv) => !isExpired(inv.expiresAt))
    .map((inv) => toOrganizationInvitation(inv, { id: inv.organizationId, name: inv.organizationName }));
}

/**
 * Revoke/cancel a pending invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  await authApi.cancelInvitation(invitationId);
}

/**
 * Resend an invitation - re-invites the same email/role with `resend: true`,
 * which extends the expiry and re-fires the invitation email natively.
 */
export async function resendInvitation(invitation: OrganizationInvitation): Promise<OrganizationInvitation> {
  const inv = await authApi.inviteMember({
    email: invitation.email,
    role: mapUserRoleToOrgRole(invitation.role),
    organizationId: invitation.organization_id,
    resend: true,
  });
  return toOrganizationInvitation(inv, invitation.organization);
}
