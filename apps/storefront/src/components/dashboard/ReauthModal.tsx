"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PasswordField } from "./PasswordField";
import { OtpInput } from "./OtpInput";
import { ApiError } from "../../lib/apiClient";

const reauthRequireCodeSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().min(1, "Code is required"),
});
const reauthPasswordOnlySchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string(),
});

export interface ReauthFormValues {
  password: string;
  code: string;
}

export interface ReauthModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireCode?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (values: ReauthFormValues) => Promise<void>;
}

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
    () => (requireCode ? reauthRequireCodeSchema : reauthPasswordOnlySchema),
    [requireCode],
  );
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReauthFormValues>({
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

  async function submit(values: ReauthFormValues): Promise<void> {
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
