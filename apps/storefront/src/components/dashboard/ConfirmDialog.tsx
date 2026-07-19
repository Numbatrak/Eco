"use client";

import { useState } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps): React.ReactElement | null {
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {description ? <p className="field-hint">{description}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
