import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { mfaCodeSchema, type MfaCode, type MfaMethod } from "@platform/shared-types";
import { AuthLayout } from "../../components/AuthLayout";
import { OtpInput } from "../../components/OtpInput";
import { TextField } from "../../components/TextField";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { decodeJwtPayload } from "../../lib/decodeJwt";
import { isMfaChallengeState, type MfaChallengeState } from "../../lib/mfaChallenge";

const MAX_ATTEMPTS = 5;
const FALLBACK_TTL_SECONDS = 300;

const methodCopy: Record<
  MfaMethod,
  { label: string; hint: string; other: MfaMethod; otherLabel: string }
> = {
  totp: {
    label: "Enter the 6-digit code from your authenticator app.",
    hint: "Authenticator app code",
    other: "email_otp",
    otherLabel: "Send code by email instead",
  },
  email_otp: {
    label: "Enter the 6-digit code we emailed you.",
    hint: "Email code",
    other: "totp",
    otherLabel: "Use your authenticator app instead",
  },
};

function secondsUntil(expiryMs: number): number {
  return Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
}

export default function TwoFactorVerifyPage(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const challenge = isMfaChallengeState(location.state)
    ? (location.state as MfaChallengeState)
    : null;

  const expiryMs = useMemo(() => {
    if (!challenge) return Date.now();
    const payload = decodeJwtPayload<{ exp?: number }>(challenge.challengeToken);
    return payload?.exp ? payload.exp * 1000 : Date.now() + FALLBACK_TTL_SECONDS * 1000;
  }, [challenge]);

  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiryMs));
  const [activeMethod, setActiveMethod] = useState<MfaMethod>(challenge?.method ?? "totp");
  const [mode, setMode] = useState<"code" | "backup">("code");
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
  } = useForm<MfaCode>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => {
      setSecondsLeft(secondsUntil(expiryMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge, expiryMs]);

  useEffect(() => {
    if (challenge && secondsLeft === 0) {
      navigate("/login", {
        replace: true,
        state: { message: "That verification code expired. Please log in again." },
      });
    }
  }, [secondsLeft, challenge, navigate]);

  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const copy = methodCopy[activeMethod];
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  async function onSubmit(values: MfaCode): Promise<void> {
    setFormError(null);
    try {
      const response = await authApi.mfaVerify({
        challengeToken: challenge!.challengeToken,
        code: values.code,
      });
      setSession(response.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        navigate("/login", { replace: true, state: { message: error.message } });
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
      const response = await authApi.mfaSendEmailOtp({ challengeToken: challenge!.challengeToken });
      setEmailNotice(response.message);
      setActiveMethod("email_otp");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not send a code right now.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <AuthLayout title="Verify it's you" subtitle={copy.label}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {mode === "code" ? (
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <OtpInput
                label={copy.hint}
                value={field.value}
                onChange={field.onChange}
                error={errors.code?.message}
                autoFocus
              />
            )}
          />
        ) : (
          <TextField
            label="Backup code"
            autoComplete="one-time-code"
            error={errors.code?.message}
            {...register("code")}
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
        {mode === "code" ? (
          <>
            <button type="button" className="btn-link" onClick={() => setActiveMethod(copy.other)}>
              {copy.otherLabel}
            </button>
            {activeMethod === "email_otp" ? (
              <button
                type="button"
                className="btn-link"
                disabled={sendingEmail}
                onClick={handleSendEmailCode}
              >
                {sendingEmail ? "Sending…" : "Resend email code"}
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
