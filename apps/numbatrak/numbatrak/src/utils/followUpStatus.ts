import { FollowUpOutcome, FollowUpStatus } from "../types/followUp";

/** Canonical spec statuses stored after migration. */
export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "awaiting",
  "followed_up",
  "resolved",
  "cancelled",
];

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  awaiting: "Awaiting follow-up",
  followed_up: "Followed up",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

/** Resolve outcomes shown when status is resolved. */
export const RESOLVED_OUTCOMES: FollowUpOutcome[] = ["converted", "not_converted"];

export const FOLLOW_UP_OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  converted: "Converted",
  not_converted: "Not converted",
  not_interested: "Not interested",
  follow_up_needed: "Follow-up needed",
  resolved: "Resolved",
  other: "Other",
};

/** Normalize legacy DB values to spec statuses (read path). */
export function normalizeFollowUpStatus(status: string): FollowUpStatus {
  switch (status) {
    case "pending":
      return "awaiting";
    case "in_progress":
      return "followed_up";
    case "completed":
      return "resolved";
    case "awaiting":
    case "followed_up":
    case "resolved":
    case "cancelled":
      return status;
    default:
      return "awaiting";
  }
}

export function isActiveFollowUpStatus(status: FollowUpStatus): boolean {
  return status === "awaiting" || status === "followed_up";
}

export function isResolvedFollowUpStatus(status: FollowUpStatus): boolean {
  return status === "resolved";
}

/** DB may still contain legacy rows during rollout — match both. */
export function statusMatchesBucket(
  rawStatus: string,
  bucket: "awaiting" | "followed_up" | "resolved" | "cancelled"
): boolean {
  const normalized = normalizeFollowUpStatus(rawStatus);
  return normalized === bucket;
}

export function activeStatusFilterValues(): string[] {
  return ["awaiting", "followed_up", "pending", "in_progress"];
}
