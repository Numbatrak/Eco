"use client";

import { authApi, type OrgMember, type OrgRecord } from "../lib/authApi";
import { supabase } from "../supabaseClient";
import { Organization, OrganizationMember } from "../types/organization";
import { UserRole } from "../types/user";
import { mapOrgRoleToUserRole, mapUserRoleToOrgRole } from "../utils/roleMapping";

function toOrganization(org: OrgRecord): Organization {
  const metadata = org.metadata ?? {};
  return {
    id: org.id,
    name: org.name,
    logo_url: org.logo ?? null,
    timezone: (metadata.timezone as string | undefined) ?? null,
    currency: (metadata.currency as string | undefined) ?? null,
    created_at: org.createdAt,
    updated_at: org.createdAt,
  };
}

function toOrganizationMember(member: OrgMember): OrganizationMember {
  return {
    id: member.id,
    organization_id: member.organizationId,
    user_id: member.userId,
    role: mapOrgRoleToUserRole(member.role),
    created_at: member.createdAt,
    updated_at: member.createdAt,
    user: {
      id: member.user.id,
      email: member.user.email ?? null,
      full_name: member.user.name ?? null,
      avatar_url: member.user.image ?? null,
    },
  };
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "org";
}

/**
 * Create a new organization and add the creator as Owner.
 * Auto-slugifies from the name; retries with a random suffix on collision
 * (mirrors apps/api's own /auth/register slug-retry logic).
 */
export async function createOrganization(name: string): Promise<Organization> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = `${slugify(name)}${suffix}`;
    try {
      const org = await authApi.createOrganization({ name: name.trim(), slug });
      return toOrganization(org);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to create organization");
}

/**
 * Fetch all members of an organization
 */
export async function fetchOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const { members } = await authApi.listMembers(organizationId);
  return members.map(toOrganizationMember);
}

/**
 * Update a member's role in an organization
 */
export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: UserRole
): Promise<void> {
  await authApi.updateMemberRole(memberId, organizationId, mapUserRoleToOrgRole(role));
}

/**
 * Remove a member from an organization
 */
export async function removeMember(organizationId: string, memberId: string): Promise<void> {
  await authApi.removeMember(memberId, organizationId);
}

/**
 * Update organization name/locale (only Owners and Admins can do this).
 * timezone/currency live in Better Auth's opaque `metadata` field - only
 * included in the request when at least one is provided, so a name-only
 * update never clobbers the other.
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
  const data: { name?: string; logo?: string | null; metadata?: Record<string, unknown> } = {};
  if (updates.name !== undefined) {
    data.name = updates.name.trim();
  }
  if (updates.logo_url !== undefined) {
    data.logo = updates.logo_url;
  }
  if (updates.timezone !== undefined || updates.currency !== undefined) {
    data.metadata = {
      ...(updates.timezone !== undefined ? { timezone: updates.timezone } : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
    };
  }

  const org = await authApi.updateOrganization(organizationId, data);
  return toOrganization(org);
}

const ORG_LOGO_BUCKET = "org-logos";
const ORG_LOGO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload a business logo and persist the public URL on the organization.
 *
 * DEFERRED: apps/api has no storage/S3 module yet, so this still goes
 * straight to Supabase Storage rather than through apps/api - the rest of
 * this file is fully migrated. Revisit once apps/api gets a storage layer.
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
