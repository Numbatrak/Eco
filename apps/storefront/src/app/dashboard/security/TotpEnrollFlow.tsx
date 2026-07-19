"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";
import { BackupCodesReveal } from "./BackupCodesReveal";

const passwordSchema = z.object({ password: z.string().min(1, "Password is required") });
type PasswordFormValues = z.infer<typeof passwordSchema>;

type Step = "password" | "qr" | "backup-codes";

export interface TotpEnrollFlowProps {
  onDone: () => void;
  onCancel: () => void;
}

export function TotpEnrollFlow({ onDone, onCancel }: TotpEnrollFlowProps): React.ReactElement {
  const [step, setStep] = useState<Step>("password");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  async function onEnable({ password }: PasswordFormValues): Promise<void> {
    setError(null);
    try {
      const data = await authApi.enableTwoFactor(password);
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
      setStep("qr");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not enable 2FA.");
    }
  }

  if (step === "backup-codes") {
    return <BackupCodesReveal codes={backupCodes} onAcknowledge={onDone} />;
  }

  if (step === "qr" && totpURI) {
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
          <h2>Scan this QR code</h2>
          <p className="field-hint">Add it to your authenticator app.</p>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <QRCodeSVG value={totpURI} size={180} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep("backup-codes")}
          >
            I&apos;ve added it
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onEnable)}
      noValidate
      className="panel"
      style={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <h2>Turn on two-factor authentication</h2>
        <p className="field-hint">Confirm your password to continue.</p>
      </div>
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
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
          {isSubmitting ? "Enabling…" : "Enable 2FA"}
        </button>
      </div>
    </form>
  );
}
