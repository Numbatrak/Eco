"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  applyRecoveryTokensFromHash,
  updatePassword,
} from "../services/authRecovery";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./LoginPage.css";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await applyRecoveryTokensFromHash();
      if (!result.success) {
        setError(result.error || "Invalid reset link");
      }
      setVerifying(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    if (!result.success) {
      setError(result.error || "Failed to reset password.");
      setLoading(false);
      return;
    }

    setMessage("Password reset successful. Redirecting to login...");
    setTimeout(() => navigate("/login", { replace: true }), 1200);
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
        </div>
      </div>
      <div className="login-right-panel">
        <div className="login-form-container">
          <div className="login-form-wrapper">
            <div className="login-form-card">
              <div className="login-header">
                <div>
                  <h1 className="login-header-title">Reset password</h1>
                  <p className="login-header-subtitle">
                    Choose a new password for your account.
                  </p>
                </div>
                <Link to="/login" className="login-signup-link">
                  Back
                </Link>
              </div>
              {verifying ? (
                <div className="login-success">Validating reset link...</div>
              ) : (
                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="login-form-group">
                    <label htmlFor="password" className="login-label">
                      New password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input"
                      required
                    />
                  </div>
                  <div className="login-form-group">
                    <label htmlFor="confirm" className="login-label">
                      Confirm password
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="login-input"
                      required
                    />
                  </div>
                  {error && <div className="login-error">{error}</div>}
                  {message && <div className="login-success">{message}</div>}
                  <button type="submit" className="login-button" disabled={loading}>
                    {loading ? "Updating..." : "Update password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
