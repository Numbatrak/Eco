"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { registerRequestSchema, type RegisterRequest } from "@platform/shared-types";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { RequireGuest } from "../../../components/dashboard/RouteGuards";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";
import { estimatePasswordStrength } from "../../../lib/passwordStrength";

function SignupForm(): React.ReactElement {
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { email: "", password: "", businessName: "" },
  });

  const password = watch("password");
  const strength = password ? estimatePasswordStrength(password) : null;

  async function onSubmit(values: RegisterRequest): Promise<void> {
    setFormError(null);
    try {
      const response = await authApi.register(values);
      setSubmittedMessage(response.message);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (submittedMessage) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={submittedMessage}
        footer={<Link href="/dashboard/login">Back to log in</Link>}
      >
        <p className="field-hint">
          If you don&apos;t see it in a minute, check spam, or try signing up again.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your storefront workspace."
      footer={
        <>
          Already have an account? <Link href="/dashboard/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Business or brand name"
          autoComplete="organization"
          error={errors.businessName?.message}
          {...register("businessName")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint={!errors.password ? "At least 12 characters." : undefined}
          error={errors.password?.message}
          {...register("password")}
        />
        {strength && !errors.password ? (
          <div className={`password-strength password-strength-${strength}`} aria-live="polite">
            Password strength: {strength}
          </div>
        ) : null}
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function SignupPage(): React.ReactElement {
  return (
    <RequireGuest>
      <SignupForm />
    </RequireGuest>
  );
}
