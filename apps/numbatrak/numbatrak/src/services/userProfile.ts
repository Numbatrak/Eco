"use client";

import { supabase } from "../supabaseClient";
import { UserProfile, UserRole } from "../types/user";
import {
  USER_PROFILE_BASE_COLUMNS,
  USER_PROFILE_COLUMNS_WITH_AVATAR,
  USER_PROFILE_COLUMNS_EXTENDED,
  isMissingAvatarColumnError,
} from "./userProfileColumns";

function mapProfileRow(
  data: Record<string, unknown>,
  includeAvatar: boolean,
  includeExtended = false
): UserProfile {
  return {
    id: data.id as string,
    email: data.email as string | null,
    full_name: data.full_name as string | null,
    avatar_url: includeAvatar
      ? ((data.avatar_url as string | null) ?? null)
      : null,
    phone: includeExtended ? ((data.phone as string | null) ?? null) : null,
    whatsapp_number: includeExtended
      ? ((data.whatsapp_number as string | null) ?? null)
      : null,
    timezone: includeExtended ? ((data.timezone as string | null) ?? null) : null,
    role: data.role as UserRole,
    email_verified: Boolean(data.email_verified),
    created_at: data.created_at as string | null,
    updated_at: data.updated_at as string | null,
  };
}

function hasExtendedProfileFields(data: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(data, "phone");
}

function mapRowFromData(
  data: Record<string, unknown>,
  includeAvatar: boolean
): UserProfile {
  return mapProfileRow(
    data,
    includeAvatar,
    hasExtendedProfileFields(data)
  );
}

/** Surface PostgREST / Postgres errors in the UI. */
export function formatProfileError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return parts.join(". ");
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function fetchProfileViaRpc(): Promise<UserProfile | null> {
  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();
  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("get_my_profile")) {
      return null;
    }
    throw error;
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return mapRowFromData(row, Object.prototype.hasOwnProperty.call(row, "avatar_url"));
}

async function queryProfileById(userId: string) {
  let result = await supabase
    .from("user_profiles")
    .select(USER_PROFILE_COLUMNS_EXTENDED)
    .eq("id", userId)
    .single();

  let includeAvatar = true;
  let includeExtended = true;

  if (result.error && (isMissingAvatarColumnError(result.error) || result.error.code === "42703")) {
    result = await supabase
      .from("user_profiles")
      .select(USER_PROFILE_COLUMNS_WITH_AVATAR)
      .eq("id", userId)
      .single();
    includeExtended = false;

    if (isMissingAvatarColumnError(result.error)) {
      result = await supabase
        .from("user_profiles")
        .select(USER_PROFILE_BASE_COLUMNS)
        .eq("id", userId)
        .single();
      includeAvatar = false;
    }
  }

  return { ...result, includeAvatar, includeExtended };
}

/**
 * Fetch current user's profile
 */
export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    try {
      const rpcProfile = await fetchProfileViaRpc();
      if (rpcProfile) return rpcProfile;
    } catch (rpcError) {
      console.warn("get_my_profile RPC failed, falling back to table query:", rpcError);
    }

    const { data, error, includeAvatar, includeExtended } = await queryProfileById(user.id);

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        console.warn("User profile table may not exist or user has no profile");
        return null;
      }
      console.error("Error fetching user profile:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return mapProfileRow(data, includeAvatar, includeExtended);
  } catch (error) {
    console.error("Unexpected error fetching user profile:", error);
    return null;
  }
}

/**
 * Fetch all user profiles (Owner and Admin only)
 */
export async function fetchAllUserProfiles(): Promise<UserProfile[]> {
  let { data, error } = await supabase
    .from("user_profiles")
    .select(USER_PROFILE_COLUMNS_WITH_AVATAR)
    .order("created_at", { ascending: false });

  let includeAvatar = true;
  if (isMissingAvatarColumnError(error)) {
    ({ data, error } = await supabase
      .from("user_profiles")
      .select(USER_PROFILE_BASE_COLUMNS)
      .order("created_at", { ascending: false }));
    includeAvatar = false;
  }

  if (error) {
    throw error;
  }

  return (data || []).map((profile) =>
    mapProfileRow(profile, includeAvatar, includeAvatar)
  );
}

/**
 * Update user profile (name / avatar — email is managed by auth)
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    whatsapp_number?: string | null;
    timezone?: string | null;
    role?: UserRole;
  }
): Promise<UserProfile> {
  const rpcPayload: {
    p_full_name?: string | null;
    p_avatar_url?: string | null;
    p_phone?: string | null;
    p_whatsapp_number?: string | null;
    p_timezone?: string | null;
  } = {};
  if (updates.full_name !== undefined) {
    rpcPayload.p_full_name = updates.full_name;
  }
  if (updates.avatar_url !== undefined) {
    rpcPayload.p_avatar_url = updates.avatar_url;
  }
  if (updates.phone !== undefined) {
    rpcPayload.p_phone = updates.phone;
  }
  if (updates.whatsapp_number !== undefined) {
    rpcPayload.p_whatsapp_number = updates.whatsapp_number;
  }
  if (updates.timezone !== undefined) {
    rpcPayload.p_timezone = updates.timezone;
  }

  if (Object.keys(rpcPayload).length > 0) {
    const { data, error } = await supabase
      .rpc("update_my_profile", rpcPayload)
      .single();

    if (!error && data) {
      const row = data as Record<string, unknown>;
      return mapRowFromData(row, Object.prototype.hasOwnProperty.call(row, "avatar_url"));
    }

    if (
      error &&
      error.code !== "PGRST202" &&
      !error.message?.includes("update_my_profile")
    ) {
      throw error;
    }
  }

  const { avatar_url, ...safeUpdates } = updates;
  const payload =
    avatar_url !== undefined ? updates : safeUpdates;

  let { data, error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", userId)
    .select(USER_PROFILE_COLUMNS_EXTENDED)
    .single();

  let includeAvatar = true;
  let includeExtended = true;
  if (isMissingAvatarColumnError(error) && avatar_url !== undefined) {
    throw new Error(
      "Profile pictures require a database update. Run: npx supabase db push"
    );
  }

  if (error && (isMissingAvatarColumnError(error) || error.code === "42703")) {
    ({ data, error } = await supabase
      .from("user_profiles")
      .update(safeUpdates)
      .eq("id", userId)
      .select(USER_PROFILE_COLUMNS_WITH_AVATAR)
      .single());
    includeExtended = false;

    if (isMissingAvatarColumnError(error)) {
      ({ data, error } = await supabase
        .from("user_profiles")
        .update(safeUpdates)
        .eq("id", userId)
        .select(USER_PROFILE_BASE_COLUMNS)
        .single());
      includeAvatar = false;
    }
  }

  if (error) {
    throw error;
  }

  return mapProfileRow(data, includeAvatar, includeExtended);
}

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload a profile picture and persist the public URL on user_profiles.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP, or GIF).");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    if (uploadError.message?.includes("Bucket not found")) {
      throw new Error(
        "Avatar storage is not set up yet. Run: npx supabase db push"
      );
    }
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);

  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await updateUserProfile(userId, { avatar_url: avatarUrl });

  return avatarUrl;
}

/**
 * Get user role (cached in session)
 */
export async function getUserRole(): Promise<UserRole | null> {
  const profile = await fetchUserProfile();
  return profile?.role || null;
}
