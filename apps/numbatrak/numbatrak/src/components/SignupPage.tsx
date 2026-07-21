"use client";

import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { registerUser } from "../services/emailVerification";
import { buildVerifyEmailPath } from "../utils/emailVerificationRoutes";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./SignupPage.css";

function getPasswordStrength(password: string, email: string) {
  const suggestions: string[] = [];
  const lengthScore = password.length >= 6 ? 1 : 0;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!lengthScore) suggestions.push("Use at least 6 characters");
  if (!hasLower) suggestions.push("Add a lowercase letter");
  if (!hasUpper) suggestions.push("Add an uppercase letter");
  if (!hasNumber) suggestions.push("Add a number");
  if (!hasSymbol) suggestions.push("Add a symbol (e.g. !@#$)");

  const emailLocalPart = email.split("@")[0]?.trim();
  if (
    emailLocalPart &&
    password.toLowerCase().includes(emailLocalPart.toLowerCase())
  ) {
    suggestions.push("Avoid using parts of your email in the password");
  }

  const score =
    lengthScore +
    (hasLower ? 1 : 0) +
    (hasUpper ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSymbol ? 1 : 0);

  const percent = Math.min(100, Math.round((score / 5) * 100));

  let label: "Weak" | "Fair" | "Good" | "Strong" = "Weak";
  if (score >= 5) label = "Strong";
  else if (score === 4) label = "Good";
  else if (score === 3) label = "Fair";

  return { score, percent, label, suggestions };
}

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = password
    ? getPasswordStrength(password, email)
    : null;

  const passwordStrengthLevel = passwordStrength ? passwordStrength.score : 0;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const registerResult = await registerUser(email, password);

      if (!registerResult.success) {
        setError(registerResult.error || "Failed to create account");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (signInError) {
        setError(
          "Account created, but sign-in failed. Please log in and verify your email.",
        );
        setTimeout(() => navigate("/login"), 2500);
        return;
      }

      setMessage(
        "Account created! Check your email for the verification code.",
      );
      setTimeout(
        () =>
          navigate(
            buildVerifyEmailPath({ from: "signup", redirect: redirectTo }),
          ),
        1500,
      );
    } catch (err: any) {
      setError(
        err.message || "An unexpected error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      {/* Left Panel - Branding with Graphics */}
      <div className="signup-left-panel">
        <div className="signup-left-content">
          {/* Logo */}
          <div className="signup-logo">
            <NumbatrakLogo size="lg" variant="onDark" showWordmark />
            <BrandTagline className="mt-2 text-sm text-[#10B981]" />
          </div>

          {/* Main Content - Centered */}
          <div className="signup-main-content">
            <div className="signup-content-wrapper">
              <h2 className="signup-title">Create your account</h2>
              <p className="signup-description">
                One workspace for orders, logistics, and reporting. No credit
                card required to register.
              </p>

              {/* Benefits List */}
              <div className="signup-benefits">
                <div className="signup-benefit-item">
                  <CheckCircle2 className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">
                      Free to get started
                    </h3>
                    <p className="signup-benefit-desc">
                      No credit card required
                    </p>
                  </div>
                </div>
                <div className="signup-benefit-item">
                  <CheckCircle2 className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">Setup in minutes</h3>
                    <p className="signup-benefit-desc">
                      Get up and running quickly
                    </p>
                  </div>
                </div>
                <div className="signup-benefit-item">
                  <CheckCircle2 className="signup-benefit-icon" />
                  <div>
                    <h3 className="signup-benefit-title">24/7 Support</h3>
                    <p className="signup-benefit-desc">
                      We're here to help you succeed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative SVG Graphics - Bottom */}
          <div className="signup-graphics">
            <svg
              viewBox="0 0 400 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="50"
                y="30"
                width="300"
                height="140"
                fill="white"
                opacity="0.1"
                rx="10"
              />
              <polyline
                points="70,150 100,110 130,130 160,50 190,70 220,30 250,40 280,10 310,20 340,0"
                stroke="white"
                strokeWidth="4"
                fill="none"
              />
              <circle cx="200" cy="100" r="40" fill="white" opacity="0.3" />
              <path
                d="M185 100 L195 110 L215 90"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Panel - Authentication Form */}
      <div className="signup-right-panel">
        <div className="signup-form-container">
          <div className="signup-form-wrapper">
            {/* Mobile Logo */}
            <div className="signup-mobile-logo">
              <div className="signup-mobile-logo-inner">
                <NumbatrakLogo size="md" variant="onDark" showWordmark />
              </div>
            </div>

            {/* Header with Login link */}
            <div className="signup-header">
              <div>
                <h1 className="signup-header-title">Create account</h1>
                <p className="signup-header-subtitle">
                  Sign up to get started with Numbatrak
                </p>
              </div>
              <Link to="/login" className="signup-login-link">
                Sign in
              </Link>
            </div>

            {/* Form Card */}
            <div className="signup-form-card">
              <form className="signup-form" onSubmit={handleSignup}>
                <div className="signup-form-group">
                  <label htmlFor="email" className="signup-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="signup-input"
                  />
                </div>

                <div className="signup-form-group">
                  <label htmlFor="password" className="signup-label">
                    Password
                  </label>
                  <div className="signup-password-field">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min. 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="signup-input signup-input-with-toggle"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="signup-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="signup-hint">Must be at least 6 characters</p>

                  {passwordStrength && (
                    <div className="signup-strength">
                      <div className="signup-strength-header">
                        <span className="signup-strength-label">Strength:</span>{" "}
                        <span
                          className={`signup-strength-value signup-strength-${passwordStrength.label.toLowerCase()}`}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="signup-strength-bar">
                        <div
                          className={`signup-strength-bar-fill signup-strength-${passwordStrength.label.toLowerCase()} signup-strength-level-${passwordStrengthLevel}`}
                        />
                      </div>
                      {passwordStrength.suggestions.length > 0 && (
                        <ul className="signup-strength-suggestions">
                          {passwordStrength.suggestions.slice(0, 3).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="signup-form-group">
                  <label htmlFor="confirmPassword" className="signup-label">
                    Confirm Password
                  </label>
                  <div className="signup-password-field">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="signup-input signup-input-with-toggle"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="signup-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="signup-error">
                    <svg
                      className="signup-alert-icon"
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
                      className="signup-alert-icon"
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
                  className="signup-button"
                >
                  {loading ? (
                    <>
                      <svg
                        className="signup-spinner"
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
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>

              <p className="signup-footer signup-footer-signin">
                Already have an account?{" "}
                <Link to="/login" className="signup-footer-link">
                  Sign in
                </Link>
              </p>

              <p className="signup-footer">
                By creating an account, you agree to our{" "}
                <Link to="/terms" className="signup-footer-link">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="signup-footer-link">
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

