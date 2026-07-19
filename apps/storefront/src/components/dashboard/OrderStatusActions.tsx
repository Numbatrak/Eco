"use client";

import { useState } from "react";
import { ORDER_STATUS_TRANSITIONS, type OrderStatusValue } from "@platform/shared-types";
import { commerceApi } from "../../lib/commerceApi";

const STATUS_ACTION_LABELS: Partial<Record<OrderStatusValue, string>> = {
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

interface OrderStatusActionsProps {
  orderId: string;
  status: OrderStatusValue;
  onUpdated: (status: OrderStatusValue) => void;
}

export function OrderStatusActions({
  orderId,
  status,
  onUpdated,
}: OrderStatusActionsProps): React.ReactElement | null {
  const [updating, setUpdating] = useState<OrderStatusValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextStatuses = ORDER_STATUS_TRANSITIONS[status];
  if (nextStatuses.length === 0) {
    return null;
  }

  async function handleTransition(next: OrderStatusValue): Promise<void> {
    setUpdating(next);
    setError(null);
    try {
      await commerceApi.updateOrderStatus(orderId, next);
      onUpdated(next);
    } catch {
      setError("Failed to update order status.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {nextStatuses.map((next) => (
          <button
            key={next}
            type="button"
            className={next === "cancelled" ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => void handleTransition(next)}
            disabled={updating !== null}
          >
            {updating === next ? "Updating…" : STATUS_ACTION_LABELS[next]}
          </button>
        ))}
      </div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
