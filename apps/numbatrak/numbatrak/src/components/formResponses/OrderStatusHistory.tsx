import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { fetchOrderStatusHistory, OrderStatusHistoryEntry } from "../../services/customerOrders";

interface OrderStatusHistoryProps {
  orderId: string;
}

export function OrderStatusHistory({ orderId }: OrderStatusHistoryProps) {
  const [entries, setEntries] = useState<OrderStatusHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    fetchOrderStatusHistory(orderId)
      .then((history) => {
        if (!cancelled) setEntries(history);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (entries === null) return null;
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Status history</span>
      </div>
      <div className="space-y-1.5 border border-border rounded-lg p-4 bg-muted/50 max-h-[240px] overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between text-sm border-b border-border/60 last:border-b-0 pb-1.5 last:pb-0"
          >
            <span className="text-foreground">
              {entry.from_status ? `${entry.from_status} → ${entry.to_status}` : `Set to ${entry.to_status}`}
            </span>
            <span className="text-muted-foreground text-xs whitespace-nowrap ml-3">
              {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
              {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
