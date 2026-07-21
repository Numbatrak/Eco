"use client";

import { supabase } from "../supabaseClient";
import { OrganizationInvitation } from "../types/organization";
import { isInvalidRefreshTokenError } from "../utils/authErrors";

import { parseEdgeFunctionError } from "../utils/edgeFunctionErrors";

async function sendInvitationEmail(invitation: OrganizationInvitation): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const invitedByName =
    user?.user_metadata?.full_name || user?.email || "your team";

  const { data, error } = await supabase.functions.invoke("send-auth-email", {
    body: {
      type: "invitation",
      to: invitation.email,
      organizationName: invitation.organization?.name || "your organization",
      role: invitation.role,
      invitationCode: invitation.invitation_code,
      expiresAt: invitation.expires_at,
      invitedByName,
    },
  });

  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }

  if (error) {
    const message = await parseEdgeFunctionError(
      data,
      error,
      "Invitation email could not be sent. Check email configuration or share the invite link manually."
    );
    throw new Error(message);
  }
}

/**
 * Create an invitation to join an organization
 */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: "Owner" | "Admin" | "Customer Relations" | "Manager" = "Customer Relations",
  expiresInDays?: number
): Promise<OrganizationInvitation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("organization_invitations")
    .insert([
      {
        organization_id: organizationId,
        email: email.toLowerCase().trim(),
        role,
        invited_by: user.id,
        expires_at: expiresAt,
      },
    ])
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .single();

  if (error) {
    if (error.code === "42P01" || error.message?.includes("schema cache")) {
      throw new Error(
        "Invitations are not set up yet. Apply migration 20260612120000_activities_and_invitations.sql"
      );
    }
    // Handle unique constraint violation (pending invitation already exists)
    if (error.code === "23505" || error.message?.includes("unique_pending_invitation")) {
      throw new Error("An invitation for this email is already pending");
    }
    throw error;
  }

  const invitation = {
    ...data,
    organization: data.organization,
  };
  await sendInvitationEmail(invitation);
  return invitation;
}

/**
 * Accept an invitation using the invitation code
 */
export async function acceptInvitation(invitationCode: string): Promise<{
  success: boolean;
  organization_id?: string;
  role?: string;
  error?: string;
}> {
  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    inv_code: invitationCode,
  });

  if (error) {
    throw error;
  }

  return data as {
    success: boolean;
    organization_id?: string;
    role?: string;
    error?: string;
  };
}

/**
 * Fetch all invitations for an organization
 */
export async function fetchOrganizationInvitations(
  organizationId: string
): Promise<OrganizationInvitation[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.message?.includes("schema cache")) {
      console.warn(
        "organization_invitations table missing. Run migration 20260612120000"
      );
      return [];
    }
    console.error("Error fetching organization invitations:", error);
    throw error;
  }

  if (!data) {
    return [];
  }

  // Fetch user profiles for invited_by users separately
  const invitedByUserIds = [...new Set(data.map((inv: any) => inv.invited_by).filter(Boolean))];
  const userProfilesMap = new Map<string, { id: string; email: string | null; full_name: string | null }>();
  
  if (invitedByUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .in("id", invitedByUserIds);
    
    if (profiles) {
      profiles.forEach((profile) => {
        userProfilesMap.set(profile.id, profile);
      });
    }
  }

  return data.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    email: row.email,
    invitation_code: row.invitation_code,
    role: row.role,
    invited_by: row.invited_by,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_by: row.accepted_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    organization: row.organization,
    invited_by_user: row.invited_by && userProfilesMap.has(row.invited_by)
      ? userProfilesMap.get(row.invited_by)!
      : undefined,
  }));
}

/**
 * Fetch pending invitations for the current user (by email)
 */
export async function fetchMyPendingInvitations(): Promise<OrganizationInvitation[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (isInvalidRefreshTokenError(userError)) {
      await supabase.auth.signOut();
    }
    throw userError;
  }

  if (!user?.email) {
    return [];
  }

  const { data, error } = await supabase
    .from("organization_invitations")
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching my pending invitations:", error);
    console.error("User email:", user.email);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  if (!data) {
    return [];
  }

  // Fetch user profiles for invited_by users separately
  const invitedByUserIds = [...new Set(data.map((inv: any) => inv.invited_by).filter(Boolean))];
  const userProfilesMap = new Map<string, { id: string; email: string | null; full_name: string | null }>();
  
  if (invitedByUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .in("id", invitedByUserIds);
    
    if (profiles) {
      profiles.forEach((profile) => {
        userProfilesMap.set(profile.id, profile);
      });
    }
  }

  return data.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    email: row.email,
    invitation_code: row.invitation_code,
    role: row.role,
    invited_by: row.invited_by,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_by: row.accepted_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    organization: row.organization,
    invited_by_user: row.invited_by && userProfilesMap.has(row.invited_by)
      ? userProfilesMap.get(row.invited_by)!
      : undefined,
  }));
}

/**
 * Revoke/delete an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    throw error;
  }
}

/**
 * Resend an invitation (extend expiry and optionally regenerate code)
 */
export async function resendInvitation(
  invitationId: string,
  expiresInDays?: number
): Promise<OrganizationInvitation> {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("organization_invitations")
    .update({
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .single();

  if (error) {
    throw error;
  }

  const invitation = {
    ...data,
    organization: data.organization,
  };
  await sendInvitationEmail(invitation);
  return invitation;
}


