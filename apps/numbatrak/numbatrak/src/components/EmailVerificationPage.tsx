"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { ArrowLeft, ShieldCheck, Clock, RefreshCw } from "lucide-react";
import {
  verifyOTP,
  resendOTP,
  isEmailVerified,
} from "../services/emailVerification";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { getVerifyEmailBackPath } from "../utils/emailVerificationRoutes";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./SignupPage.css";

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const redirectTo = searchParams.get("redirect");
  const { signOut, refreshProfile } = useSupabaseAuth();
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const postVerifyDestination =
    redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  const backPath = getVerifyEmailBackPath(from);
  const backLabel = from === "signup" ? "Back to sign up" : "Back to sign in";

  const completeVerification = useCallback(async () => {
    await refreshProfile();
    setIsVerified(true);
    setMessage("Email verified successfully! Redirecting...");
    setTimeout(() => {
      navigate(postVerifyDestination, { replace: true });
    }, 1500);
  }, [navigate, postVerifyDestination, refreshProfile]);

  useEffect(() => {
    const verifyPath = `${window.location.pathname}${window.location.search}`;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate(
          `/login?redirect=${encodeURIComponent(verifyPath)}`,
          { replace: true },
        );
      }
    });
    void checkVerificationStatus();
    void loadUserEmail();
  }, []);

  const loadUserEmail = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    } catch (err) {
      console.error("Error loading user email:", err);
    }
  };

  const checkVerificationStatus = async () => {
    try {
      const verified = await isEmailVerified();
      if (verified) {
        setIsVerified(true);
        setMessage("Your email is already verified!");
        setTimeout(() => {
          navigate(postVerifyDestination, { replace: true });
        }, 2000);
      }
    } catch (err) {
      console.error("Error checking verification status:", err);
    }
  };

  const handleBack = async () => {
    await signOut();
    navigate(backPath, { replace: true });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    setLoading(true);
    const result = await verifyOTP(otpCode);

    if (result.success) {
      await completeVerification();
    } else {
      setError(result.error || "Invalid verification code");
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setResending(true);

    const result = await resendOTP();

    if (result.success) {
      setMessage("Verification code resent! Please check your email.");
    } else {
      setError(result.error || "Failed to resend verification code");
    }
    setResending(false);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpCode(value);
    if (value.length === 6) {
      setError(null);
      setMessage(null);
      setLoading(true);
      void verifyOTP(value).then(async (result) => {
        if (result.success) {
          await completeVerification();
        } else {
          setError(result.error || "Invalid verification code");
        }
        setLoading(false);
      });
    }
  };

  if (isVerified) {
    return (
      <div className="signup-container">
        <div className="signup-right-panel">
          <div className="signup-form-container">
            <div className="signup-form-wrapper">
              <div className="signup-mobile-logo">
                <div className="signup-mobile-logo-inner">
                  <NumbatrakLogo size="md" variant="onDark" showWordmark />
                </div>
              </div>

              <div className="signup-form-card">
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 20px",
                    }}
                  >
                    <svg
                      style={{ width: 32, height: 32, color: "white" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2
                    style={{
                      fontSize: "24px",
                      fontWeight: 600,
                      marginBottom: "10px",
                    }}
                  >
                    Email Verified!
                  </h2>
                  <p style={{ color: "#6b7280", marginBottom: "30px" }}>
                    Your email has been successfully verified.
                  </p>
                  <Link to={postVerifyDestination} className="signup-button">
                    {postVerifyDestination === "/"
                      ? "Go to Dashboard"
                      : "Continue"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-left-panel">
        <div className="signup-left-content">
          <div className="signup-logo">
            <NumbatrakLogo size="lg" variant="onDark" showWordmark />
            <BrandTagline className="mt-2 text-sm text-[#10B981]" />
          </div>

          <div className="signup-main-content">
            <div className="signup-content-wrapper">
              <h2 className="signup-title">One Last Step</h2>
              <p className="signup-description">
                We sent a 6-digit verification code to your email. Enter it to
                activate your account and get started.
              </p>

              <div className="signup-benefits">
                <div className="signup-benefit-item">
                  <ShieldCheck className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">Secure your account</h3>
                    <p className="signup-benefit-desc">Email verification keeps you safe</p>
                  </div>
                </div>
                <div className="signup-benefit-item">
                  <Clock className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">Code expires in 15 min</h3>
                    <p className="signup-benefit-desc">Request a new one if needed</p>
                  </div>
                </div>
                <div className="signup-benefit-item">
                  <RefreshCw className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">Didn't get it?</h3>
                    <p className="signup-benefit-desc">Check spam or resend below</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="signup-graphics">
            <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="50" y="30" width="300" height="140" fill="white" opacity="0.1" rx="10" />
              <circle cx="200" cy="100" r="50" fill="white" opacity="0.15" />
              <path d="M180 100 L195 115 L225 85" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="100" y="60" width="30" height="4" rx="2" fill="white" opacity="0.4" />
              <rect x="100" y="72" width="50" height="4" rx="2" fill="white" opacity="0.3" />
              <rect x="270" y="60" width="30" height="4" rx="2" fill="white" opacity="0.4" />
              <rect x="260" y="72" width="50" height="4" rx="2" fill="white" opacity="0.3" />
            </svg>
          </div>
        </div>
      </div>

      <div className="signup-right-panel">
        <div className="signup-form-container">
          <div className="signup-form-wrapper">
            <div className="signup-mobile-logo">
              <div className="signup-mobile-logo-inner">
                <NumbatrakLogo size="md" variant="onDark" showWordmark />
              </div>
            </div>

            <div className="signup-header">
              <div>
                <h1 className="signup-header-title">Verify your email</h1>
                <p className="signup-header-subtitle">
                  {userEmail
                    ? `Code sent to ${userEmail}`
                    : "Enter the code sent to your email"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleBack()}
                className="signup-login-link flex items-center gap-2"
              >
                <ArrowLeft className="size-4" />
                {backLabel}
              </button>
            </div>

            <div className="signup-form-card">
              <form className="signup-form" onSubmit={handleVerify}>
                <div className="signup-form-group">
                  <label htmlFor="otp" className="signup-label">
                    6-digit verification code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otpCode}
                    onChange={handleOtpChange}
                    required
                    autoFocus
                    className="signup-input"
                    style={{
                      textAlign: "center",
                      fontSize: "28px",
                      letterSpacing: "10px",
                      fontFamily: "monospace",
                    }}
                  />
                  <p className="signup-hint">
                    Submits automatically when all 6 digits are entered
                  </p>
                </div>

                {error && (
                  <div className="signup-error">
                    <svg
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {error}
                  </div>
                )}
                {message && (
                  <div className="signup-success">
                    <svg
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.length === 0}
                  className="signup-button"
                >
                  {loading ? (
                    <>
                      <svg
                        className="signup-spinner"
                        style={{ width: 20, height: 20 }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    "Verify Email"
                  )}
                </button>

                <div className="signup-resend-section">
                  <p className="signup-resend-label">Didn't receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="signup-button"
                    style={{
                      background: "transparent",
                      color: "#2563eb",
                      border: "1px solid #2563eb",
                    }}
                  >
                    {resending ? "Sending..." : "Resend Code"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
