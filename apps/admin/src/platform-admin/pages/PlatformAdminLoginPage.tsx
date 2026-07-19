import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import {
  platformAdminLoginRequestSchema,
  type PlatformAdminLoginRequest,
} from "@platform/shared-types";
import { AuthLayout } from "../../components/AuthLayout";
import { TextField } from "../../components/TextField";
import { PasswordField } from "../../components/PasswordField";
import { platformAdminAuthApi } from "../lib/platformAdminAuthApi";
import { ApiError } from "../../lib/apiClient";
import { usePlatformAdminAuth } from "../context/PlatformAdminAuthContext";
import type { PlatformAdminTwoFactorPendingState } from "./PlatformAdminTwoFactorVerifyPage";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export default function PlatformAdminLoginPage(): React.ReactElement {
  const { refreshMe } = usePlatformAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationMessage = (location.state as { message?: string } | null)?.message ?? null;
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(locationMessage);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlatformAdminLoginRequest>({
    resolver: zodResolver(platformAdminLoginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: PlatformAdminLoginRequest): Promise<void> {
    setFormError(null);
    setNotice(null);
    try {
      const response = await platformAdminAuthApi.login(values);
      if ("twoFactorRedirect" in response) {
        const pending: PlatformAdminTwoFactorPendingState = {
          twoFactorMethods: response.twoFactorMethods,
        };
        navigate("/2fa/verify", { state: pending });
        return;
      }
      await refreshMe();
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from ? `${from.pathname}${from.search}` : "/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 429)) {
        setFormError(error.status === 429 ? error.message : GENERIC_LOGIN_ERROR);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="pa-shell">
      <AuthLayout title="Admin" subtitle="Sign in to manage the platform.">
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthLayout>
    </div>
  );
}
