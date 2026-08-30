"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Mail, ShieldCheck, XCircle } from "lucide-react";
import { authApi } from "../lib/authApi";
import { getVerifyEmailBackPath } from "../utils/emailVerificationRoutes";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./SignupPage.css";

type VerificationState = "verifying" | "success" | "error" | "missing-token";

export function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const from = searchParams.get("from");
  const backPath = getVerifyEmailBackPath(from);
  const backLabel = from === "signup" ? "Back to sign up" : "Back to sign in";

  const [state, setState] = useState<VerificationState>(token ? "verifying" : "missing-token");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    authApi
      .verifyEmail(token)
      .then(() => setState("success"))
      .catch(() => setState("error"));
  }, [token]);

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    setResendMessage(null);
    setResendError(null);
    setResending(true);
    try {
      await authApi.resendVerificationEmail(resendEmail);
      setResendMessage("Verification email sent! Please check your inbox.");
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend verification email.");
    }
    setResending(false);
  };

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
              <h2 className="signup-title">Confirm your email</h2>
              <p className="signup-description">
                We sent a verification link to your inbox when you signed up.
                Click it to activate your account.
              </p>

              <div className="signup-benefits">
                <div className="signup-benefit-item">
                  <ShieldCheck className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">Secure your account</h3>
                    <p className="signup-benefit-desc">Email verification keeps you safe</p>
                  </div>
                </div>
              </div>
            </div>
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
              </div>
              <Link to={backPath} className="signup-login-link">
                {backLabel}
              </Link>
            </div>

            <div className="signup-form-card">
              {state === "verifying" && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p className="signup-hint">Verifying your email...</p>
                </div>
              )}

              {state === "success" && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <CheckCircle2 size={48} color="#10b981" style={{ margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "10px" }}>
                    Email verified!
                  </h2>
                  <p style={{ color: "#6b7280", marginBottom: "24px" }}>
                    Your email has been successfully verified.
                  </p>
                  <Link to="/login" className="signup-button">
                    Continue to login
                  </Link>
                </div>
              )}

              {(state === "error" || state === "missing-token") && (
                <>
                  <div style={{ textAlign: "center", padding: "24px 20px 8px" }}>
                    <XCircle size={40} color="#ef4444" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "#6b7280", marginBottom: "8px" }}>
                      {state === "missing-token"
                        ? "This verification link is missing its token."
                        : "This verification link is invalid or has expired."}
                    </p>
                  </div>

                  <form className="signup-form" onSubmit={handleResend}>
                    <div className="signup-form-group">
                      <label htmlFor="resend-email" className="signup-label">
                        Resend verification email
                      </label>
                      <input
                        id="resend-email"
                        type="email"
                        placeholder="name@example.com"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        required
                        className="signup-input"
                        autoComplete="email"
                      />
                    </div>
                    {resendError && <div className="signup-error">{resendError}</div>}
                    {resendMessage && <div className="signup-success">{resendMessage}</div>}
                    <button type="submit" disabled={resending} className="signup-button">
                      <Mail size={16} style={{ marginRight: 8 }} />
                      {resending ? "Sending..." : "Resend verification email"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
