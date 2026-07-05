import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeSVG } from "qrcode.react";
import { mfaCodeSchema, type MfaCode } from "@platform/shared-types";
import { OtpInput } from "../../components/OtpInput";
import { authApi } from "../../lib/authApi";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { BackupCodesReveal } from "./BackupCodesReveal";

type Step = "intro" | "confirm" | "backup-codes";

export interface TotpEnrollFlowProps {
  onDone: () => void;
  onCancel: () => void;
}

export function TotpEnrollFlow({ onDone, onCancel }: TotpEnrollFlowProps): React.ReactElement {
  const { accessToken, refreshMfaStatus } = useAuth();
  const [step, setStep] = useState<Step>("intro");
  const [setupData, setSetupData] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
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
      const data = await authApi.totpSetup(accessToken as string);
      setSetupData(data);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start setup.");
    } finally {
      setStarting(false);
    }
  }

  async function onConfirm(values: MfaCode): Promise<void> {
    setError(null);
    try {
      const response = await authApi.totpConfirm(accessToken as string, values);
      setBackupCodes(response.backupCodes);
      setStep("backup-codes");
    } catch (err) {
      reset({ code: "" });
      setError(err instanceof ApiError ? err.message : "Invalid code.");
    }
  }

  if (step === "backup-codes") {
    return (
      <BackupCodesReveal
        codes={backupCodes}
        onAcknowledge={() => {
          void refreshMfaStatus().then(onDone);
        }}
      />
    );
  }

  if (step === "confirm" && setupData) {
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
          <h2>Scan this QR code</h2>
          <p className="field-hint">
            Use your authenticator app (1Password, Authy, Google Authenticator, etc).
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <QRCodeSVG value={setupData.otpauthUrl} size={180} />
        </div>
        <div className="field">
          <span className="field-label">Can&apos;t scan? Enter this code manually</span>
          <code
            style={{
              wordBreak: "break-all",
              background: "var(--paper)",
              padding: 8,
              borderRadius: 6,
            }}
          >
            {setupData.secret}
          </code>
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
                label="Enter the 6-digit code"
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
        <h2>Enable authenticator app (TOTP)</h2>
        <p className="field-hint">You&apos;ll scan a QR code and confirm with a 6-digit code.</p>
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
          {starting ? "Starting…" : "Start setup"}
        </button>
      </div>
    </div>
  );
}
