"use client";

import { supabase } from "../supabaseClient";
import { parseEdgeFunctionError } from "../utils/edgeFunctionErrors";

/**
 * Register a new user via the custom edge function (Brevo OTP email, no Supabase auth email).
 */
export async function registerUser(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("register-user", {
      body: {
        email: email.toLowerCase().trim(),
        password,
      },
    });

    if (data?.error) {
      return { success: false, error: data.error };
    }

    if (error) {
      const message = await parseEdgeFunctionError(
        data,
        error,
        "An account with this email already exists. Try signing in instead.",
      );
      return { success: false, error: message };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = await parseEdgeFunctionError(
      null,
      error,
      "Failed to create account. Please try again.",
    );
    return { success: false, error: message };
  }
}

/**
 * Request OTP for email verification
 */
export async function requestEmailVerificationOTP(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Call the database function to create OTP
    const { data, error } = await supabase.rpc('create_verification_otp', {
      // Key order matters for some schema-cache/function resolution paths.
      p_email: email.toLowerCase().trim(),
      p_user_id: user.id
    });

    if (error) {
      console.error("Error creating OTP:", error);
      throw error;
    }

    // The OTP code is returned from the function
    const otpCode = data;

    const { data: emailData, error: emailError } = await supabase.functions.invoke(
      "send-verification-email",
      {
        body: {
          email: email.toLowerCase().trim(),
          otp_code: otpCode,
          user_name: user.user_metadata?.full_name || email,
        },
      }
    );

    if (emailError || (emailData && typeof emailData === "object" && "error" in emailData)) {
      const message = await parseEdgeFunctionError(
        emailData,
        emailError,
        "Verification email could not be sent. Check email configuration or contact support."
      );
      return {
        success: false,
        error: message,
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error requesting OTP:", error);
    return {
      success: false,
      error: error.message || "Failed to request verification code",
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(otpCode: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Call the database function to verify OTP
    const { data, error } = await supabase.rpc('verify_otp', {
      // Key order matters for some schema-cache/function resolution paths.
      p_otp_code: otpCode.trim(),
      p_user_id: user.id
    });

    if (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    }

    if (!data) {
      return {
        success: false,
        error: "Invalid or expired verification code",
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return {
      success: false,
      error: error.message || "Failed to verify code",
    };
  }
}

/**
 * Check if user's email is verified
 */
export async function isEmailVerified(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("email_verified")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return false;
    }

    return data.email_verified || false;
  } catch (error) {
    console.error("Error checking email verification:", error);
    return false;
  }
}

/**
 * Resend OTP
 */
export async function resendOTP(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      throw new Error("User not authenticated or email not found");
    }

    return await requestEmailVerificationOTP(user.email);
  } catch (error: any) {
    console.error("Error resending OTP:", error);
    return {
      success: false,
      error: error.message || "Failed to resend verification code",
    };
  }
}
