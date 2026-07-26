"use client";

import { supabase } from "../supabaseClient";
import { parseEdgeFunctionError } from "../utils/edgeFunctionErrors";

export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("request-password-reset", {
      body: { email: email.toLowerCase().trim() },
    });
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
      return { success: false, error: (data as { error: string }).error };
    }
    if (error) {
      const message = await parseEdgeFunctionError(
        data,
        error,
        "Failed to send password reset email. Check email configuration."
      );
      return { success: false, error: message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to request password reset",
    };
  }
}

export async function applyRecoveryTokensFromHash(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    if (type !== "recovery" || !access_token || !refresh_token) {
      return { success: false, error: "Invalid or expired password reset link" };
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate reset link",
    };
  }
}

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
