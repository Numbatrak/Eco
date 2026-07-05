import { useState } from "react";
import type { MfaDisableRequest } from "@platform/shared-types";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../lib/authApi";
import { ReauthModal } from "../../components/ReauthModal";
import { TotpEnrollFlow } from "./TotpEnrollFlow";
import { EmailOtpEnrollFlow } from "./EmailOtpEnrollFlow";
import { BackupCodesReveal } from "./BackupCodesReveal";

type ActiveFlow = "none" | "totp" | "email-otp";
type ModalKind = "disable" | "regenerate" | null;

const LOW_BACKUP_CODE_THRESHOLD = 2;

function StatusRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function SecuritySettingsPage(): React.ReactElement {
  const { accessToken, mfaStatus, refreshMfaStatus } = useAuth();
  const [flow, setFlow] = useState<ActiveFlow>("none");
  const [modal, setModal] = useState<ModalKind>(null);
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);

  if (!mfaStatus) {
    return <p className="field-hint">Loading security settings…</p>;
  }

  async function handleDisable(values: MfaDisableRequest): Promise<void> {
    await authApi.mfaDisable(accessToken as string, values);
    setModal(null);
    await refreshMfaStatus();
  }

  async function handleRegenerate(values: MfaDisableRequest): Promise<void> {
    const response = await authApi.backupCodesRegenerate(accessToken as string, values);
    setModal(null);
    setRegeneratedCodes(response.backupCodes);
  }

  const wrapperStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: "0 auto",
    padding: "var(--space-6)",
  };

  if (regeneratedCodes) {
    return (
      <div style={wrapperStyle}>
        <BackupCodesReveal
          codes={regeneratedCodes}
          onAcknowledge={() => {
            setRegeneratedCodes(null);
            void refreshMfaStatus();
          }}
        />
      </div>
    );
  }

  if (flow === "totp") {
    return (
      <div style={wrapperStyle}>
        <TotpEnrollFlow onDone={() => setFlow("none")} onCancel={() => setFlow("none")} />
      </div>
    );
  }

  if (flow === "email-otp") {
    return (
      <div style={wrapperStyle}>
        <EmailOtpEnrollFlow onDone={() => setFlow("none")} onCancel={() => setFlow("none")} />
      </div>
    );
  }

  const isEnabled = mfaStatus.totpEnabled || mfaStatus.emailOtpEnabled;
  const lowOnBackupCodes =
    isEnabled && mfaStatus.unusedBackupCodeCount <= LOW_BACKUP_CODE_THRESHOLD;

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <div>
        <h1>Two-factor authentication</h1>
      </div>

      <div
        className="panel"
        style={{
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <StatusRow
          label="Authenticator app (TOTP)"
          value={mfaStatus.totpEnabled ? "Enabled" : "Not enabled"}
        />
        <StatusRow
          label="Email codes"
          value={mfaStatus.emailOtpEnabled ? "Enabled" : "Not enabled"}
        />
        {isEnabled ? (
          <StatusRow
            label="Backup codes remaining"
            value={String(mfaStatus.unusedBackupCodeCount)}
          />
        ) : null}
      </div>

      {lowOnBackupCodes ? (
        <div className="banner banner-danger" role="alert">
          You&apos;re running low on backup codes ({mfaStatus.unusedBackupCodeCount} left).
          Regenerate them so you don&apos;t get locked out.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {!mfaStatus.totpEnabled ? (
          <button type="button" className="btn btn-secondary" onClick={() => setFlow("totp")}>
            Enable authenticator app
          </button>
        ) : null}
        {!mfaStatus.emailOtpEnabled ? (
          <button type="button" className="btn btn-secondary" onClick={() => setFlow("email-otp")}>
            Enable email codes
          </button>
        ) : null}
        {isEnabled ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModal("regenerate")}
            >
              Regenerate backup codes
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setModal("disable")}>
              Disable 2FA
            </button>
          </>
        ) : null}
      </div>

      <ReauthModal
        open={modal === "disable"}
        title="Disable two-factor authentication"
        description="Confirm your password and a current 2FA code to continue."
        confirmLabel="Disable 2FA"
        onCancel={() => setModal(null)}
        onConfirm={handleDisable}
      />
      <ReauthModal
        open={modal === "regenerate"}
        title="Regenerate backup codes"
        description="Confirm your password and a current 2FA code. Your existing backup codes will stop working."
        confirmLabel="Regenerate codes"
        onCancel={() => setModal(null)}
        onConfirm={handleRegenerate}
      />
    </main>
  );
}
