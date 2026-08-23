import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
            className={`pr-10 ${className ?? ""}`}
            {...props}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {hint && !error ? (
          <span className="text-xs text-muted-foreground" id={hintId}>
            {hint}
          </span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive" id={errorId} role="alert">
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
