"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { passwordResetRequestSchema, type PasswordResetRequest } from "@platform/shared-types";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { TextField } from "../../../components/dashboard/TextField";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link.";

export default function ForgotPasswordPage(): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequest>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: PasswordResetRequest): Promise<void> {
    setFormError(null);
    try {
      await authApi.requestPasswordReset(values);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError("Something went wrong. Please try again.");
        return;
      }
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={GENERIC_MESSAGE}
        footer={<Link href="/dashboard/login">Back to log in</Link>}
      >
        <p className="field-hint">The link expires in 15 minutes.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to reset it."
      footer={<Link href="/dashboard/login">Back to log in</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthLayout>
  );
}
