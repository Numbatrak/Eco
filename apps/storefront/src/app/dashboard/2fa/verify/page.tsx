"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { AuthLayout } from "../../../../components/dashboard/AuthLayout";
import { OtpInput } from "../../../../components/dashboard/OtpInput";
import { TextField } from "../../../../components/dashboard/TextField";
import { useAuth } from "../../../../components/dashboard/AuthContext";
import { authApi } from "../../../../lib/authApi";
import { ApiError } from "../../../../lib/apiClient";
import {
  clearMfaChallenge,
  readMfaChallenge,
  type MfaChallengeState,
} from "../../../../lib/mfaChallenge";

const MAX_ATTEMPTS = 5;
const PENDING_COOKIE_TTL_SECONDS = 600;

const codeSchema = z.object({ code: z.string().min(1, "Code is required") });
type CodeFormValues = z.infer<typeof codeSchema>;

function secondsUntil(expiryMs: number): number {
  return Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
}

export default function TwoFactorVerifyPage(): React.ReactElement | null {
  const router = useRouter();
  const { refreshMe } = useAuth();

  const [challenge, setChallenge] = useState<MfaChallengeState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const expiryMs = useMemo(() => Date.now() + PENDING_COOKIE_TTL_SECONDS * 1000, []);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiryMs));
  const [mode, setMode] = useState<"code" | "backup" | "email">("code");
  const [attemptCount, setAttemptCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    const stored = readMfaChallenge();
    setChallenge(stored);
    setHydrated(true);
    if (!stored) {
      router.replace("/dashboard/login");
    }
  }, [router]);

  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => {
      setSecondsLeft(secondsUntil(expiryMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge, expiryMs]);

  useEffect(() => {
    if (challenge && secondsLeft === 0) {
      clearMfaChallenge();
      router.replace("/dashboard/login");
    }
  }, [secondsLeft, challenge, router]);

  if (!hydrated) return null;
  if (!challenge) return null;

  const methods = challenge.twoFactorMethods;
  const hasTotp = methods.includes("totp");
  const hasEmailOtp = methods.includes("otp") || methods.includes("email_otp");
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  async function onSubmit(values: CodeFormValues): Promise<void> {
    setFormError(null);
    try {
      if (mode === "backup") {
        await authApi.verifyBackupCode(values.code);
      } else if (mode === "email") {
        await authApi.verifyOtp(values.code);
      } else {
        await authApi.verifyTotp(values.code);
      }
      clearMfaChallenge();
      await refreshMe();
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        clearMfaChallenge();
        router.replace("/dashboard/login");
        return;
      }
      setAttemptCount((n) => n + 1);
      reset({ code: "" });
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  async function handleSendEmailCode(): Promise<void> {
    setSendingEmail(true);
    setEmailNotice(null);
    setFormError(null);
    try {
      await authApi.sendOtp();
      setEmailNotice("Emailed you a fresh code.");
      setMode("email");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not send a code right now.");
    } finally {
      setSendingEmail(false);
    }
  }

  const subtitle =
    mode === "email"
      ? "Enter the 6-digit code we emailed you."
      : mode === "backup"
        ? "Enter one of your saved backup codes."
        : "Enter the 6-digit code from your authenticator app.";

  return (
    <AuthLayout title="Verify it's you" subtitle={subtitle}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {mode === "backup" ? (
          <TextField
            label="Backup code"
            autoComplete="one-time-code"
            error={errors.code?.message}
            {...register("code")}
          />
        ) : (
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <OtpInput
                label={mode === "email" ? "Email code" : "Authenticator app code"}
                value={field.value}
                onChange={field.onChange}
                error={errors.code?.message}
                autoFocus
              />
            )}
          />
        )}

        <div className="banner banner-muted" role="status">
          Code expires in {minutes}:{seconds}
          {attemptCount > 0
            ? ` · attempt ${Math.min(attemptCount + 1, MAX_ATTEMPTS)} of ${MAX_ATTEMPTS}`
            : null}
        </div>

        {emailNotice ? (
          <div className="banner banner-success" role="status">
            {emailNotice}
          </div>
        ) : null}
        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
        {mode !== "backup" ? (
          <>
            {hasTotp && mode !== "code" ? (
              <button type="button" className="btn-link" onClick={() => setMode("code")}>
                Use your authenticator app instead
              </button>
            ) : null}
            {hasEmailOtp ? (
              <button
                type="button"
                className="btn-link"
                disabled={sendingEmail}
                onClick={handleSendEmailCode}
              >
                {sendingEmail
                  ? "Sending…"
                  : mode === "email"
                    ? "Resend email code"
                    : "Send code by email instead"}
              </button>
            ) : null}
            <button type="button" className="btn-link" onClick={() => setMode("backup")}>
              Use a backup code instead
            </button>
          </>
        ) : (
          <button type="button" className="btn-link" onClick={() => setMode("code")}>
            Back to code entry
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
