"use client";

import { supabase } from "../supabaseClient";
import { Organization, OrganizationMember, OrganizationWithRole } from "../types/organization";
import {
  USER_PROFILE_BASE_COLUMNS,
  USER_PROFILE_COLUMNS_WITH_AVATAR,
  isMissingAvatarColumnError,
} from "./userProfileColumns";

/**
 * Fetch all organizations the current user is a member of
 */
export async function fetchUserOrganizations(): Promise<OrganizationWithRole[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        organization_id,
        role,
        organization:organizations(*)
      `)
      .eq("user_id", user.id);

    // If table doesn't exist (migration not run), return empty array
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn("Organization tables not found. Please run the database migration.");
        return [];
      }
      // Handle network errors
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Network error')) {
        throw new Error(
          "Network error: Unable to connect to Supabase. Please check your internet connection."
        );
      }
      throw error;
    }

    if (!data) {
      return [];
    }

    return data
      .filter((row: { organization?: { id?: string } | null }) => row.organization?.id)
      .map((row: any) => ({
      id: row.organization.id,
      name: row.organization.name,
      logo_url: row.organization.logo_url ?? null,
      timezone: row.organization.timezone ?? null,
      currency: row.organization.currency ?? null,
      created_at: row.organization.created_at,
      updated_at: row.organization.updated_at,
      role: row.role,
    }));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "");
    if (
      message.includes("Invalid Refresh Token") ||
      message.includes("Refresh Token Not Found")
    ) {
      throw error;
    }
    if (
      message.includes("Network error") ||
      message.includes("Failed to fetch")
    ) {
      throw error;
    }
    console.error("Error fetching organizations:", error);
    throw error;
  }
}

/**
 * Create a new organization and add the creator as Owner
 * Uses a database function to ensure atomic creation and bypass RLS issues
 */
export async function createOrganization(name: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    // Use the database function to create organization and add owner atomically
    const { data, error } = await supabase.rpc('create_organization_with_owner', {
      p_name: name.trim()
    });

    if (error) {
      // If function doesn't exist, fall back to manual creation
      if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        console.warn("create_organization_with_owner function not found, using manual creation");
        return await createOrganizationManual(name);
      }
      
      // Handle network errors
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Network error')) {
        throw new Error(
          "Network error: Unable to connect to Supabase. Please check your internet connection."
        );
      }
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("Failed to create organization");
    }

    return {
      id: data[0].id,
      name: data[0].name,
      logo_url: data[0].logo_url ?? null,
      timezone: data[0].timezone ?? null,
      currency: data[0].currency ?? null,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at,
    };
  } catch (error: any) {
    // Re-throw network errors
    if (error?.message?.includes('Network error') || error?.message?.includes('Failed to fetch')) {
      throw error;
    }
    throw error;
  }
}

/**
 * Fallback: Manual organization creation (used if function doesn't exist)
 */
async function createOrganizationManual(name: string): Promise<Organization> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert([{ name }])
    .select()
    .single();

  if (orgError) {
    // Handle network errors
    if (orgError.message?.includes('Failed to fetch') || orgError.message?.includes('Network error')) {
      throw new Error(
        "Network error: Unable to connect to Supabase. Please check your internet connection."
      );
    }
    throw orgError;
  }

  if (!org) {
    throw new Error("Failed to create organization");
  }

  // Add creator as Owner
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert([
      {
        organization_id: org.id,
        user_id: user.id,
        role: "Owner",
      },
    ]);

  if (memberError) {
    // Rollback organization creation
    await supabase.from("organizations").delete().eq("id", org.id);
    // Handle network errors
    if (memberError.message?.includes('Failed to fetch') || memberError.message?.includes('Network error')) {
      throw new Error(
        "Network error: Unable to connect to Supabase. Please check your internet connection."
      );
    }
    throw memberError;
  }

  return org;
}

/**
 * Join an existing organization (requires invitation or public join logic)
 * For now, this is a placeholder - you may want to implement invitation system
 */
export async function joinOrganization(organizationId: string, role: "Customer Relations" = "Customer Relations"): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("organization_members")
    .insert([
      {
        organization_id: organizationId,
        user_id: user.id,
        role,
      },
    ]);

  if (error) {
    throw error;
  }
}

/**
 * Fetch all members of an organization
 */
export async function fetchOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return [];
  }

  const userIds = [...new Set(data.map((r) => r.user_id))];

  type ProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url?: string | null;
  };

  let profiles: ProfileRow[] | null = null;
  let pErr: { code?: string; message?: string } | null = null;

  const withAvatar = await supabase
    .from("user_profiles")
    .select(USER_PROFILE_COLUMNS_WITH_AVATAR)
    .in("id", userIds);

  profiles = withAvatar.data as ProfileRow[] | null;
  pErr = withAvatar.error;

  if (pErr && isMissingAvatarColumnError(pErr)) {
    const base = await supabase
      .from("user_profiles")
      .select(USER_PROFILE_BASE_COLUMNS)
      .in("id", userIds);
    profiles = base.data as ProfileRow[] | null;
    pErr = base.error;
  }

  if (pErr) {
    throw pErr;
  }

  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  return data.map((row) => {
    const p = byId.get(row.user_id);
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: p
        ? {
            id: p.id,
            email: p.email || null,
            full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null,
          }
        : {
            id: row.user_id,
            email: null,
            full_name: null,
            avatar_url: null,
          },
    };
  });
}

/**
 * Update a member's role in an organization
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: "Owner" | "Admin" | "Customer Relations" | "Manager"
): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/**
 * Remove a member from an organization
 */
export async function removeMember(organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/**
 * Get user's role in a specific organization
 */
export async function getUserOrganizationRole(organizationId: string): Promise<"Owner" | "Admin" | "Customer Relations" | "Manager" | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as "Owner" | "Admin" | "Customer Relations" | "Manager";
}

/**
 * Update organization name (only Owners and Admins can do this)
 */
export async function updateOrganization(
  organizationId: string,
  updates: {
    name?: string;
    logo_url?: string | null;
    timezone?: string;
    currency?: string;
  }
): Promise<Organization> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    payload.name = updates.name.trim();
  }
  if (updates.logo_url !== undefined) {
    payload.logo_url = updates.logo_url;
  }
  if (updates.timezone !== undefined) {
    payload.timezone = updates.timezone;
  }
  if (updates.currency !== undefined) {
    payload.currency = updates.currency;
  }

  const { data, error } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Failed to update organization");
  }

  return {
    id: data.id,
    name: data.name,
    logo_url: data.logo_url ?? null,
    timezone: data.timezone ?? null,
    currency: data.currency ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

const ORG_LOGO_BUCKET = "org-logos";
const ORG_LOGO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload a business logo and persist the public URL on organizations.
 */
export async function uploadOrganizationLogo(
  organizationId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP, GIF, or SVG).");
  }
  if (file.size > ORG_LOGO_MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${organizationId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ORG_LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    if (uploadError.message?.includes("Bucket not found")) {
      throw new Error(
        "Logo storage is not set up yet. Run: npx supabase db push"
      );
    }
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from(ORG_LOGO_BUCKET)
    .getPublicUrl(path);

  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
  await updateOrganization(organizationId, { logo_url: logoUrl });
  return logoUrl;
}

