"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { passwordResetCompleteSchema } from "@platform/shared-types";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";

const formSchema = passwordResetCompleteSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof formSchema>;

const REDIRECT_DELAY_MS = 3000;

function ResetPasswordContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => router.replace("/dashboard/login"), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [completed, router]);

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle="This password reset link is missing its token."
        footer={<Link href="/dashboard/forgot-password">Request a new link</Link>}
      >
        <p className="field-hint">Copy the full link from the email, or request a new one.</p>
      </AuthLayout>
    );
  }

  if (completed) {
    return (
      <AuthLayout
        title="Password updated"
        footer={<Link href="/dashboard/login">Log in now</Link>}
      >
        <div className="banner banner-success" role="status">
          Your password has been changed and all other sessions have been signed out. Redirecting
          you to log in…
        </div>
      </AuthLayout>
    );
  }

  async function onSubmit(values: ResetPasswordFormValues): Promise<void> {
    setFormError(null);
    try {
      await authApi.completePasswordReset({
        token: token as string,
        newPassword: values.newPassword,
      });
      setCompleted(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      footer={<Link href="/dashboard/login">Back to log in</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint={!errors.newPassword ? "At least 12 characters." : undefined}
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
