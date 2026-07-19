import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { OtpInput } from "../../components/OtpInput";
import { TextField } from "../../components/TextField";
import { platformAdminAuthApi } from "../lib/platformAdminAuthApi";
import { ApiError } from "../../lib/apiClient";
import { usePlatformAdminAuth } from "../context/PlatformAdminAuthContext";

const MAX_ATTEMPTS = 5;
// Matches Better Auth's default twoFactorCookieMaxAge (not overridden for
// this instance either) - same approximation-from-mount approach as the
// tenant-member TwoFactorVerifyPage.
const PENDING_COOKIE_TTL_SECONDS = 600;

const codeSchema = z.object({ code: z.string().min(1, "Code is required") });
type CodeFormValues = z.infer<typeof codeSchema>;

export interface PlatformAdminTwoFactorPendingState {
  twoFactorMethods: string[];
}

export function isPlatformAdminTwoFactorPendingState(
  value: unknown,
): value is PlatformAdminTwoFactorPendingState {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as PlatformAdminTwoFactorPendingState).twoFactorMethods)
  );
}

function secondsUntil(expiryMs: number): number {
  return Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
}

/**
 * This instance only supports TOTP + backup codes (no email OTP, per the
 * platform-admin 2FA spec) - unlike the tenant-member verify page, there's
 * no method-switching UI or "resend email code" action.
 */
export default function PlatformAdminTwoFactorVerifyPage(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshMe } = usePlatformAdminAuth();

  const pending = isPlatformAdminTwoFactorPendingState(location.state) ? location.state : null;
  const expiryMs = useMemo(() => Date.now() + PENDING_COOKIE_TTL_SECONDS * 1000, []);

  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiryMs));
  const [mode, setMode] = useState<"code" | "backup">("code");
  const [attemptCount, setAttemptCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

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
    if (!pending) return;
    const interval = setInterval(() => {
      setSecondsLeft(secondsUntil(expiryMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [pending, expiryMs]);

  useEffect(() => {
    if (pending && secondsLeft === 0) {
      navigate("/login", {
        replace: true,
        state: { message: "That verification code expired. Please sign in again." },
      });
    }
  }, [secondsLeft, pending, navigate]);

  if (!pending) {
    return <Navigate to="/login" replace />;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  async function onSubmit(values: CodeFormValues): Promise<void> {
    setFormError(null);
    try {
      if (mode === "backup") {
        await platformAdminAuthApi.verifyBackupCode(values.code);
      } else {
        await platformAdminAuthApi.verifyTotp(values.code);
      }
      await refreshMe();
      navigate("/", { replace: true });
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

  return (
    <div className="pa-shell">
      <AuthLayout
        title="Verify it's you"
        subtitle="Enter the 6-digit code from your authenticator app."
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {mode === "code" ? (
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <OtpInput
                  label="Authenticator app code"
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
            <button type="button" className="btn-link" onClick={() => setMode("backup")}>
              Use a backup code instead
            </button>
          ) : (
            <button type="button" className="btn-link" onClick={() => setMode("code")}>
              Back to code entry
            </button>
          )}
        </div>
      </AuthLayout>
    </div>
  );
}
