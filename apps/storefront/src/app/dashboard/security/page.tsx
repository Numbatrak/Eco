"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { PasswordField } from "../../../components/dashboard/PasswordField";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";
import { TotpEnrollFlow } from "./TotpEnrollFlow";
import { BackupCodesReveal } from "./BackupCodesReveal";

type ActiveModal = "disable" | "regenerate" | null;

const passwordSchema = z.object({ password: z.string().min(1, "Password is required") });
type PasswordFormValues = z.infer<typeof passwordSchema>;

function PasswordConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (values: PasswordFormValues) => Promise<void>;
}): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  async function submit(values: PasswordFormValues): Promise<void> {
    setError(null);
    try {
      await onConfirm(values);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {description ? <p className="field-hint">{description}</p> : null}
        <form onSubmit={handleSubmit(submit)} noValidate>
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
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
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

function StatusRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SecurityInner(): React.ReactElement {
  const { user, refreshMe } = useAuth();
  const [flow, setFlow] = useState<"none" | "totp">("none");
  const [modal, setModal] = useState<ActiveModal>(null);
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);

  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);

  if (regeneratedCodes) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <BackupCodesReveal
          codes={regeneratedCodes}
          onAcknowledge={() => {
            setRegeneratedCodes(null);
            void refreshMe();
          }}
        />
      </div>
    );
  }

  if (flow === "totp") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <TotpEnrollFlow
          onDone={() => {
            setFlow("none");
            void refreshMe();
          }}
          onCancel={() => setFlow("none")}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <h1>Security</h1>

      <div
        className="panel"
        style={{
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <StatusRow label="Two-factor authentication" value={twoFactorEnabled ? "On" : "Off"} />
        <p className="field-hint">
          {twoFactorEnabled
            ? "You'll be asked for a code from your authenticator app when signing in."
            : "Add a second layer to your login by scanning a QR code with an authenticator app."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {twoFactorEnabled ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal("regenerate")}
              >
                Regenerate backup codes
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setModal("disable")}>
                Turn off 2FA
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setFlow("totp")}>
              Turn on 2FA
            </button>
          )}
        </div>
      </div>

      {modal === "disable" ? (
        <PasswordConfirmModal
          title="Turn off two-factor authentication?"
          description="This weakens the security of your account."
          confirmLabel="Turn off 2FA"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async ({ password }) => {
            await authApi.disableTwoFactor(password);
            setModal(null);
            await refreshMe();
          }}
        />
      ) : null}

      {modal === "regenerate" ? (
        <PasswordConfirmModal
          title="Regenerate backup codes?"
          description="Your existing backup codes will stop working immediately."
          confirmLabel="Generate new codes"
          onCancel={() => setModal(null)}
          onConfirm={async ({ password }) => {
            const response = await authApi.generateBackupCodes(password);
            setModal(null);
            setRegeneratedCodes(response.backupCodes);
          }}
        />
      ) : null}
    </div>
  );
}

export default function SecurityPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <SecurityInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
