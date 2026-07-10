"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginRequestSchema, type LoginRequest } from "@platform/shared-types";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { RequireGuest } from "../../../components/dashboard/RouteGuards";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";
import { writeMfaChallenge } from "../../../lib/mfaChallenge";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

function LoginForm(): React.ReactElement {
  const { refreshMe } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

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
    try {
      const response = await authApi.login(values);
      if ("twoFactorRedirect" in response) {
        writeMfaChallenge({ twoFactorMethods: response.twoFactorMethods });
        router.push("/dashboard/2fa/verify");
        return;
      }
      await refreshMe();
      router.replace("/dashboard");
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
          Don&apos;t have an account? <Link href="/dashboard/signup">Sign up</Link>
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
          <Link href="/dashboard/forgot-password" className="btn-link">
            Forgot password?
          </Link>
        </div>
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

export default function LoginPage(): React.ReactElement {
  return (
    <RequireGuest>
      <LoginForm />
    </RequireGuest>
  );
}
