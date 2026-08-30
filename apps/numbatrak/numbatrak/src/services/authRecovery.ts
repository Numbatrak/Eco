"use client";

import { supabase } from "../supabaseClient";

/**
 * Still used by ProfilePage.tsx's Supabase-Auth-backed "change password"
 * flow - kept separate from apps/api's Better Auth-backed
 * request/reset-password endpoints (see lib/authApi.ts), which the
 * forgot-password flow uses instead.
 */
export async function updatePassword(newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update password",
    };
  }
}
