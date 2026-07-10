"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, hint, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="field">
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
        <div style={{ position: "relative" }}>
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            className="text-input"
            style={{ paddingRight: 64 }}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
            {...props}
          />
          <button
            type="button"
            className="btn-link"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {hint && !error ? (
          <span className="field-hint" id={hintId}>
            {hint}
          </span>
        ) : null}
        {error ? (
          <span className="field-error" id={errorId} role="alert">
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
