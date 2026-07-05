import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { mfaDisableRequestSchema, type MfaDisableRequest } from "@platform/shared-types";
import { PasswordField } from "./PasswordField";
import { OtpInput } from "./OtpInput";
import { ApiError } from "../lib/apiClient";

export interface ReauthModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Whether a 2FA code is required in addition to the password. Default true (the disable-2FA/regenerate-backup-codes bar). Set false for actions gating users who may not have 2FA enabled. */
  requireCode?: boolean;
  /** Red "danger" button vs the normal accent button. Default true. */
  danger?: boolean;
  onCancel: () => void;
  /** password + current 2FA code, verified server-side before the caller's action runs. */
  onConfirm: (values: MfaDisableRequest) => Promise<void>;
}

/**
 * Password + current-2FA-code re-confirmation dialog. Reused by disable-2FA,
 * regenerate-backup-codes, and saving live-mode payment credentials - all
 * gate real-world-consequential actions behind the same re-auth bar.
 */
export function ReauthModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  requireCode = true,
  danger = true,
  onCancel,
  onConfirm,
}: ReauthModalProps): React.ReactElement | null {
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      requireCode
        ? mfaDisableRequestSchema
        : z.object({ password: z.string().min(1, "Password is required"), code: z.string() }),
    [requireCode],
  );
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MfaDisableRequest>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", code: "" },
  });

  if (!open) {
    return null;
  }

  function handleCancel(): void {
    reset();
    setServerError(null);
    onCancel();
  }

  async function submit(values: MfaDisableRequest): Promise<void> {
    setServerError(null);
    try {
      await onConfirm(values);
      reset();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-modal-title"
      className="modal-overlay"
      onClick={handleCancel}
    >
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="reauth-modal-title">{title}</h2>
        {description ? <p className="field-hint">{description}</p> : null}
        <form onSubmit={handleSubmit(submit)} noValidate>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          {requireCode ? (
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <OtpInput
                  label="Current 2FA code"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.code?.message}
                />
              )}
            />
          ) : null}
          {serverError ? (
            <div className="banner banner-danger" role="alert">
              {serverError}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className={danger ? "btn btn-danger" : "btn btn-primary"}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Confirming…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
