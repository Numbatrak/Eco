import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginRequestSchema, type LoginRequest } from "@platform/shared-types";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { PasswordField } from "../../components/PasswordField";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import type { MfaChallengeState } from "../../lib/mfaChallenge";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export default function LoginPage(): React.ReactElement {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationMessage = (location.state as { message?: string } | null)?.message ?? null;
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(locationMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginRequest): Promise<void> {
    setFormError(null);
    setNotice(null);
    try {
      const response = await authApi.login(values);
      if (response.status === "authenticated") {
        setSession(response.accessToken);
        const from = (location.state as { from?: Location } | null)?.from;
        navigate(from ? `${from.pathname}${from.search}` : "/dashboard", { replace: true });
        return;
      }
      const challengeState: MfaChallengeState = {
        challengeToken: response.challengeToken,
        method: response.method,
      };
      navigate("/2fa/verify", { state: challengeState });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        setFormError(GENERIC_LOGIN_ERROR);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back."
      footer={
        <>
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <div style={{ textAlign: "right" }}>
          <Link to="/forgot-password" className="btn-link">
            Forgot password?
          </Link>
        </div>
        {notice ? (
          <div className="banner banner-muted" role="status">
            {notice}
          </div>
        ) : null}
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
