/**
 * Sanitizers for text inputs standing in for `<input type="number">`.
 * Native number inputs are hard to work with (leading zeros get "stuck",
 * scrolling the mouse wheel over a focused one silently changes the value) -
 * these keep the same "must be a number" guarantee on a plain text input by
 * stripping anything non-numeric on every keystroke.
 */

/** Digits only - for integer fields (quantities, counts, points). */
export function sanitizeIntegerInput(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Digits plus at most one decimal point - for currency/decimal fields. */
export function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** Same as sanitizeDecimalInput, but keeps a single leading minus - for +/- amount fields. */
export function sanitizeSignedDecimalInput(value: string): string {
  const negative = value.trim().startsWith("-");
  const magnitude = sanitizeDecimalInput(value);
  return negative ? `-${magnitude}` : magnitude;
}
