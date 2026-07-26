/**
 * Nigerian phone number validation (mobile + landline patterns).
 * Accepts +234, 234, or local 0-prefix formats.
 */

const NG_PHONE_REGEX =
  /^(?:\+?234|0)?(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[0-9])\d{7}$/;

/** Strip spaces, dashes, and parentheses for validation. */
export function normalizePhoneInput(value: string): string {
  return value.replace(/[\s\-().]/g, "").trim();
}

/** True when value looks like a valid Nigerian phone number. */
export function isValidNigerianPhone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const normalized = normalizePhoneInput(value);
  if (!normalized) return false;
  return NG_PHONE_REGEX.test(normalized);
}

/** Human-readable error for invalid phone fields. */
export function phoneValidationMessage(label = "Phone number"): string {
  return `${label} must be a valid Nigerian number (e.g. +2348012345678 or 08012345678).`;
}
