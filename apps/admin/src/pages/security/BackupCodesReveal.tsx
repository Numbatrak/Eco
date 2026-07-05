import { useState } from "react";

export interface BackupCodesRevealProps {
  codes: string[];
  onAcknowledge: () => void;
}

/**
 * Full-screen, one-time display of newly issued backup codes. No "skip for
 * now" - the mandatory checkbox is the only way past this screen, because
 * these codes are never retrievable again after this render.
 */
export function BackupCodesReveal({
  codes,
  onAcknowledge,
}: BackupCodesRevealProps): React.ReactElement {
  const [checked, setChecked] = useState(false);

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
        <h2>Save your backup codes</h2>
        <p className="field-hint">
          Each code works once, to get back in if you lose access to your authenticator app or
          email. Store them somewhere safe - they won&apos;t be shown again.
        </p>
      </div>
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          listStyle: "none",
          padding: 0,
          margin: 0,
          fontFamily: "monospace",
          fontSize: 15,
        }}
      >
        {codes.map((code) => (
          <li key={code} className="panel" style={{ padding: "8px 12px", textAlign: "center" }}>
            {code}
          </li>
        ))}
      </ul>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        I&apos;ve saved these backup codes somewhere safe.
      </label>
      <button type="button" className="btn btn-primary" disabled={!checked} onClick={onAcknowledge}>
        Continue
      </button>
    </div>
  );
}
