export type PasswordStrength = "weak" | "fair" | "strong";

/**
 * A client-side hint only - the backend is the source of truth for whether a
 * password is acceptable (currently just a length floor). This never blocks
 * submission on its own.
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length < 12) {
    return "weak";
  }
  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/[0-9]/.test(password)) variety++;
  if (/[^a-zA-Z0-9]/.test(password)) variety++;

  if (password.length >= 16 && variety >= 3) {
    return "strong";
  }
  if (variety >= 2) {
    return "fair";
  }
  return "weak";
}
