import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <Input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          className={className}
          {...props}
        />
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
TextField.displayName = "TextField";
