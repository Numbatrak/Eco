"use client";

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Clock, KeyRound, Mail, Shield } from "lucide-react";
import { authApi } from "../lib/authApi";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./LoginPage.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      await authApi.requestPasswordReset(email);
      setMessage("If this email exists, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email right now.");
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-left-panel">
        <div className="login-left-content">
          <div className="login-logo">
            <NumbatrakLogo size="lg" variant="onDark" showWordmark />
            <BrandTagline className="mt-2 text-sm text-[#10B981]" />
          </div>

          <div className="login-main-content">
            <div className="login-content-wrapper">
              <h2 className="login-title">Secure account recovery</h2>
              <p className="login-description">
                Your workspace holds orders, delivery records, and financial
                snapshots. We verify identity before allowing a password change.
              </p>

              <div className="login-features">
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Mail size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Email verification</h3>
                    <p className="login-feature-desc">
                      Reset links go only to your registered address
                    </p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Clock size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Time-limited links</h3>
                    <p className="login-feature-desc">
                      Links expire automatically for your protection
                    </p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <KeyRound size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">No password disclosure</h3>
                    <p className="login-feature-desc">
                      We never send your current password by email
                    </p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Shield size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Org-scoped access</h3>
                    <p className="login-feature-desc">
                      Your organizations stay isolated after recovery
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="login-graphics">
            <svg
              viewBox="0 0 400 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="120"
                y="50"
                width="160"
                height="100"
                rx="12"
                fill="white"
                opacity="0.15"
              />
              <circle cx="200" cy="85" r="22" fill="white" opacity="0.35" />
              <path
                d="M190 85 L197 92 L212 77"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="155" y="115" width="90" height="8" rx="4" fill="white" opacity="0.5" />
              <rect x="170" y="130" width="60" height="8" rx="4" fill="white" opacity="0.35" />
            </svg>
          </div>
        </div>
      </div>

      <div className="login-right-panel">
        <div className="login-form-container">
          <div className="login-form-wrapper">
            <div className="login-mobile-logo">
              <div className="login-mobile-logo-inner">
                <NumbatrakLogo size="md" variant="onDark" showWordmark />
              </div>
            </div>

            <div className="login-form-card">
              <div className="login-header">
                <div>
                  <h1 className="login-header-title">Forgot password</h1>
                  <p className="login-header-subtitle">
                    Enter your account email and we will send a secure reset link.
                  </p>
                </div>
                <Link to="/login" className="login-signup-link">
                  Back
                </Link>
              </div>
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-form-group">
                  <label htmlFor="email" className="login-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="login-input"
                    autoComplete="email"
                  />
                </div>
                {error && <div className="login-error">{error}</div>}
                {message && <div className="login-success">{message}</div>}
                <button type="submit" disabled={loading} className="login-button">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <p className="login-footer">
                Remember your password?{" "}
                <Link to="/login" className="login-footer-link">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
