"use client";

import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Package, TrendingUp, Users, Shield, Eye, EyeOff } from "lucide-react";
import { isEmailVerified } from "../services/emailVerification";
import { fetchMyPendingInvitations } from "../services/organizationInvitations";
import { buildVerifyEmailPath } from "../utils/emailVerificationRoutes";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showVerifyLink, setShowVerifyLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setShowVerifyLink(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setError(
            "Your email isn't verified yet. Please check your inbox for the verification code.",
          );
          setShowVerifyLink(true);
        } else if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      // Login successful — require app email verification before app access
      const verified = await isEmailVerified();
      if (!verified) {
        setMessage("Please verify your email to continue.");
        setLoading(false);
        navigate(
          buildVerifyEmailPath({
            from: "login",
            redirect: redirectTo,
          }),
          { replace: true },
        );
        return;
      }

      // Check for pending invitations
      setMessage("Logged in! Checking for invitations...");
      setLoading(false);

      // Check for pending invitations
      try {
        if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
          setMessage("Logged in! Redirecting...");
          setTimeout(() => {
            navigate(redirectTo, { replace: true });
          }, 300);
          return;
        }

        const invitations = await fetchMyPendingInvitations();
        if (invitations.length > 0) {
          setMessage(
            `Logged in! You have ${invitations.length} pending invitation(s). Redirecting...`,
          );
          setTimeout(() => {
            navigate("/accept-invitation", { replace: true });
          }, 1000);
        } else {
          setMessage("Logged in! Redirecting...");
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 300);
        }
      } catch (err) {
        // If we can't check invitations, just redirect to dashboard
        setMessage("Logged in! Redirecting...");
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 300);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Panel - Branding with Graphics */}
      <div className="login-left-panel">
        <div className="login-left-content">
          {/* Logo */}
          <div className="login-logo">
            <NumbatrakLogo size="lg" variant="onDark" showWordmark />
            <BrandTagline className="mt-2 text-sm text-[#10B981]" />
          </div>

          {/* Main Content - Centered */}
          <div className="login-main-content">
            <div className="login-content-wrapper">
              <h2 className="login-title">Operations in one place</h2>
              <p className="login-description">
                Orders, deliveries, inventory, and expenses: structured data
                you can act on. Sign in to continue.
              </p>

              {/* Feature Icons */}
              <div className="login-features">
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <TrendingUp size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Analytics</h3>
                    <p className="login-feature-desc">Real-time insights</p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Users size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Team Management</h3>
                    <p className="login-feature-desc">Collaborate seamlessly</p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Package size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Order Tracking</h3>
                    <p className="login-feature-desc">End-to-end visibility</p>
                  </div>
                </div>
                <div className="login-feature-item">
                  <div className="login-feature-icon">
                    <Shield size={20} color="white" />
                  </div>
                  <div>
                    <h3 className="login-feature-title">Secure</h3>
                    <p className="login-feature-desc">
                      Enterprise-grade security
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative SVG Graphics - Bottom */}
          <div className="login-graphics">
            <svg
              viewBox="0 0 400 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M50 120 L100 120 L120 80 L200 80 L220 120 L300 120 L300 140 L50 140 Z"
                fill="white"
              />
              <circle cx="100" cy="140" r="20" fill="white" />
              <circle cx="280" cy="140" r="20" fill="white" />
              <rect
                x="250"
                y="40"
                width="60"
                height="60"
                fill="white"
                opacity="0.8"
              />
              <rect
                x="320"
                y="60"
                width="50"
                height="50"
                fill="white"
                opacity="0.6"
              />
              <polyline
                points="50,160 80,140 110,150 140,110 170,120 200,90 230,100 260,70 290,80 320,50 350,60"
                stroke="white"
                strokeWidth="3"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Panel - Authentication Form */}
      <div className="login-right-panel">
        <div className="login-form-container">
          <div className="login-form-wrapper">
            {/* Mobile Logo */}
            <div className="login-mobile-logo">
              <div className="login-mobile-logo-inner">
                <NumbatrakLogo size="md" variant="onDark" showWordmark />
              </div>
            </div>

            {/* Header with Signup link */}
            <div className="login-header">
              <div>
                <h1 className="login-header-title">Welcome back</h1>
                <p className="login-header-subtitle">
                  Sign in to your account to continue
                </p>
              </div>
              <Link to="/signup" className="login-signup-link">
                Sign up
              </Link>
            </div>

            {/* Form Card */}
            <div className="login-form-card">
              <form className="login-form" onSubmit={handleLogin}>
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
                  />
                </div>

                <div className="login-form-group">
                  <div className="login-password-row">
                    <label htmlFor="password" className="login-label">
                      Password
                    </label>
                    <Link to="/forgot-password" className="login-forgot-link">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="login-password-field">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="login-input login-input-with-toggle"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="login-error">
                    <svg
                      className="login-alert-icon"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      {error}
                      {showVerifyLink && (
                        <>
                          {" "}
                          <Link
                            to={buildVerifyEmailPath({
                              from: "login",
                              redirect: redirectTo,
                            })}
                            className="login-footer-link"
                          >
                            Go to verification page
                          </Link>
                        </>
                      )}
                    </span>
                  </div>
                )}
                {message && (
                  <div className="login-success">
                    <svg
                      className="login-alert-icon"
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
                  disabled={loading}
                  className="login-button"
                >
                  {loading ? (
                    <>
                      <svg
                        className="login-spinner"
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
                      Logging in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <p className="login-footer">
                By signing in, you agree to our{" "}
                <Link to="/terms" className="login-footer-link">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="login-footer-link">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

