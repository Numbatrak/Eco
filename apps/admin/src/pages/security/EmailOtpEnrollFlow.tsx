import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mfaCodeSchema, type MfaCode } from "@platform/shared-types";
import { OtpInput } from "../../components/OtpInput";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";

type Step = "intro" | "confirm";

export interface EmailOtpEnrollFlowProps {
  onDone: () => void;
  onCancel: () => void;
}

export function EmailOtpEnrollFlow({
  onDone,
  onCancel,
}: EmailOtpEnrollFlowProps): React.ReactElement {
  const { accessToken, refreshMfaStatus } = useAuth();
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MfaCode>({
    resolver: zodResolver(mfaCodeSchema),
    defaultValues: { code: "" },
  });

  async function handleStart(): Promise<void> {
    setStarting(true);
    setError(null);
    try {
      await authApi.emailOtpSetup(accessToken as string);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a code.");
    } finally {
      setStarting(false);
    }
  }

  async function onConfirm(values: MfaCode): Promise<void> {
    setError(null);
    try {
      await authApi.emailOtpConfirm(accessToken as string, values);
      await refreshMfaStatus();
      onDone();
    } catch (err) {
      reset({ code: "" });
      setError(err instanceof ApiError ? err.message : "Invalid code.");
    }
  }

  if (step === "confirm") {
    return (
      <div
        className="panel"
        style={{
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <div>
          <h2>Check your email</h2>
          <p className="field-hint">Enter the 6-digit code we just emailed you.</p>
        </div>
        <form
          onSubmit={handleSubmit(onConfirm)}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <OtpInput
                label="Email code"
                value={field.value}
                onChange={field.onChange}
                error={errors.code?.message}
                autoFocus
              />
            )}
          />
          {error ? (
            <div className="banner banner-danger" role="alert">
              {error}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              Confirm
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      className="panel"
      style={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <h2>Enable email codes</h2>
        <p className="field-hint">We&apos;ll email a 6-digit code to confirm it&apos;s you.</p>
      </div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={starting} onClick={handleStart}>
          {starting ? "Sending…" : "Send code"}
        </button>
      </div>
    </div>
  );
}
