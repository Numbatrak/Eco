import type { MfaMethod } from "@platform/shared-types";

/** Passed via router location state (never the URL) between /login and /2fa/verify. */
export interface MfaChallengeState {
  challengeToken: string;
  method: MfaMethod;
}

export function isMfaChallengeState(value: unknown): value is MfaChallengeState {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as MfaChallengeState).challengeToken === "string" &&
    typeof (value as MfaChallengeState).method === "string"
  );
}
