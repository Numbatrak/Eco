/**
 * Better Auth's second-factor flow is cookie-based server-side — the client
 * only needs to know which methods the server accepts so the verify page
 * can render the right UI. Persisted via sessionStorage between /login and
 * /dashboard/2fa/verify (App Router has no router.state equivalent).
 */
export const MFA_CHALLENGE_KEY = "dashboard_mfa_challenge";

export interface MfaChallengeState {
  twoFactorMethods: string[];
}

export function isMfaChallengeState(value: unknown): value is MfaChallengeState {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as MfaChallengeState).twoFactorMethods)
  );
}

export function readMfaChallenge(): MfaChallengeState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(MFA_CHALLENGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isMfaChallengeState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeMfaChallenge(state: MfaChallengeState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MFA_CHALLENGE_KEY, JSON.stringify(state));
}

export function clearMfaChallenge(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(MFA_CHALLENGE_KEY);
}
