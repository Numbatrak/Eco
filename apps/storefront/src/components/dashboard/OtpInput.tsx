"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: string;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

const DIGITS_ONLY = /\D/g;

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  label,
  autoFocus,
  disabled,
}: OtpInputProps): React.ReactElement {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const errorId = error ? "otp-input-error" : undefined;

  function commit(next: string): void {
    const cleaned = next.replace(DIGITS_ONLY, "").slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) {
      onComplete?.(cleaned);
    }
  }

  function handleChange(index: number, raw: string): void {
    const cleaned = raw.replace(DIGITS_ONLY, "");
    if (!cleaned) {
      commit(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    if (cleaned.length > 1) {
      commit(value.slice(0, index) + cleaned);
      const target = Math.min(index + cleaned.length, length - 1);
      inputRefs.current[target]?.focus();
      return;
    }
    const next = value.slice(0, index) + cleaned + value.slice(index + 1);
    commit(next);
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      commit(value.slice(0, index - 1) + value.slice(index));
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.replace(DIGITS_ONLY, "")) {
      return;
    }
    event.preventDefault();
    const cleaned = pasted.replace(DIGITS_ONLY, "");
    const next = value.slice(0, index) + cleaned;
    commit(next);
    const target = Math.min(index + cleaned.length, length - 1);
    inputRefs.current[target]?.focus();
  }

  return (
    <div className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <div role="group" aria-label={label ?? "One-time code"} style={{ display: "flex", gap: 8 }}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            className="text-input"
            style={{ width: 40, textAlign: "center", padding: "10px 0" }}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={errorId}
            aria-label={`Digit ${index + 1} of ${length}`}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
          />
        ))}
      </div>
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
