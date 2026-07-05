import { forwardRef, useId, type InputHTMLAttributes } from "react";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="field">
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className="text-input"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          {...props}
        />
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
TextField.displayName = "TextField";
