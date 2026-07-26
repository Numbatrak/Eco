// Server-side port of the source Numbatrak app's src/constants/orderStatus.ts,
// kept verbatim (can't import frontend code from apps/api).

export const PIPELINE_STATUSES = ["new", "confirmed", "packed", "dispatched", "delivered"] as const;
export const TERMINAL_STATUSES = ["failed", "returned", "lost"] as const;
export const LEGACY_STATUSES = ["pending", "completed", "cancelled", "abandoned"] as const;

export type OrderStatus = string;

/** Statuses that count as delivered for profit, wallet, and inventory. */
export const DELIVERED_STATUSES: readonly string[] = ["delivered", "completed"];

const NEXT_STATUS: Partial<Record<string, string>> = {
  new: "confirmed",
  pending: "confirmed",
  confirmed: "packed",
  packed: "dispatched",
  dispatched: "delivered",
};

/** Normalize legacy status for display / pipeline logic. */
export function normalizeOrderStatus(status: string | null | undefined): string {
  if (!status) return "new";
  if (status === "pending") return "new";
  if (status === "completed") return "delivered";
  return status;
}

export function isDeliveredStatus(status: string | null | undefined): boolean {
  return DELIVERED_STATUSES.includes(status ?? "");
}

export function getNextStatus(status: string | null | undefined): string | null {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return null;
  return NEXT_STATUS[normalized] ?? null;
}

/** Map UI filter value to DB statuses (includes legacy aliases). */
export function statusFilterToDbValues(filter: string): string[] {
  switch (filter) {
    case "new":
      return ["new", "pending"];
    case "delivered":
      return ["delivered", "completed"];
    default:
      return [filter];
  }
}
