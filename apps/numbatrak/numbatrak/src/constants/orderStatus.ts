/**
 * Spec order status pipeline. Legacy rows may still use pending/completed/cancelled.
 * Treat `completed` and `delivered` as delivered everywhere via isDeliveredStatus().
 */

export const PIPELINE_STATUSES = [
  "new",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
] as const;

export const TERMINAL_STATUSES = ["failed", "returned", "lost"] as const;

export const LEGACY_STATUSES = [
  "pending",
  "completed",
  "cancelled",
  "abandoned",
] as const;

export type PipelineOrderStatus = (typeof PIPELINE_STATUSES)[number];
export type TerminalOrderStatus = (typeof TERMINAL_STATUSES)[number];
export type LegacyOrderStatus = (typeof LEGACY_STATUSES)[number];

export type OrderStatus =
  | PipelineOrderStatus
  | TerminalOrderStatus
  | LegacyOrderStatus;

/** Statuses that count as delivered for profit, wallet, and inventory. */
export const DELIVERED_STATUSES: readonly string[] = ["delivered", "completed"];

export const ACTIVE_PIPELINE_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "packed",
  "dispatched",
  "pending",
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  failed: "Failed delivery",
  returned: "Returned",
  lost: "Lost",
  pending: "Pending (legacy)",
  completed: "Delivered (legacy)",
  cancelled: "Cancelled",
  abandoned: "Abandoned cart",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  pending: "confirmed",
  confirmed: "packed",
  packed: "dispatched",
  dispatched: "delivered",
};

/** Normalize legacy status for display / pipeline logic. */
export function normalizeOrderStatus(
  status: string | null | undefined
): OrderStatus {
  if (!status) return "new";
  if (status === "pending") return "new";
  if (status === "completed") return "delivered";
  return status as OrderStatus;
}

export function isDeliveredStatus(status: string | null | undefined): boolean {
  return DELIVERED_STATUSES.includes(status ?? "");
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  const s = normalizeOrderStatus(status);
  return (
    TERMINAL_STATUSES.includes(s as TerminalOrderStatus) ||
    status === "cancelled"
  );
}

export function canAdvanceStatus(status: string | null | undefined): boolean {
  const s = normalizeOrderStatus(status);
  return s === "new" || s === "confirmed" || s === "packed" || s === "dispatched";
}

export function getNextStatus(
  status: string | null | undefined
): OrderStatus | null {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return null;
  return NEXT_STATUS[normalized] ?? null;
}

/** Preferred write value when marking an order delivered. */
export function toDeliveredStatus(): "delivered" {
  return "delivered";
}

/** Status options shown in order edit UI (pipeline + terminal + legacy cancel). */
export const ORDER_STATUS_SELECT_OPTIONS: { value: OrderStatus; label: string }[] =
  [
    { value: "new", label: "New" },
    { value: "confirmed", label: "Confirmed" },
    { value: "packed", label: "Packed" },
    { value: "dispatched", label: "Dispatched" },
    { value: "delivered", label: "Delivered" },
    { value: "failed", label: "Failed delivery" },
    { value: "returned", label: "Returned" },
    { value: "lost", label: "Lost" },
    { value: "cancelled", label: "Cancelled" },
  ];

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

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return "New";
  return ORDER_STATUS_LABELS[status] ?? status;
}
