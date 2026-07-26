import { WalletOrderRow, WalletStatus } from "../../types/wallet";
import { formatNaira, formatShortId } from "../../utils/currency";
import { Button } from "../ui/button";
import { Check, ArrowUpCircle } from "lucide-react";
import { LoadingState } from "../ui/LoadingState";

const STATUS_LABELS: Record<WalletStatus, string> = {
  pending_remittance: "Pending remittance",
  collected: "Collected",
  released: "Released",
};

const STATUS_CLASS: Record<WalletStatus, string> = {
  pending_remittance:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  collected: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  released: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
};

interface WalletOrdersTableProps {
  orders: WalletOrderRow[];
  loading?: boolean;
  canManage?: boolean;
  onConfirmRemittance?: (order: WalletOrderRow) => void;
  onRelease?: (order: WalletOrderRow) => void;
  actionId?: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function orderDisplayAmount(order: WalletOrderRow): number {
  if (order.amount_paid != null && order.amount_paid > 0) {
    return order.amount_paid;
  }
  return order.order_revenue;
}

export function WalletOrdersTable({
  orders,
  loading,
  canManage,
  onConfirmRemittance,
  onRelease,
  actionId,
}: WalletOrdersTableProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <LoadingState label="Loading wallet orders…" size="sm" className="py-4" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
        No delivered orders in this period. Orders appear here after they are
        marked delivered in Orders or Waybills.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Order
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Customer
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Agent
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Delivered
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Method
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Amount
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Status
              </th>
              {canManage && (
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => {
              const status = order.wallet_status ?? "pending_remittance";
              const busy = actionId === order.id;
              return (
                <tr
                  key={`${order.source}-${order.id}`}
                  className={`border-b border-border last:border-0 ${
                    index % 2 === 0 ? "" : "bg-muted/20"
                  }`}
                >
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-muted-foreground">
                      {formatShortId(order.id)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {order.customer_name || "N/A"}
                    </div>
                    {order.phone_number && (
                      <div className="text-xs text-muted-foreground">
                        {order.phone_number}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {order.agent_name || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(order.completed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="uppercase text-xs font-semibold text-muted-foreground">
                      {order.payment_method === "online" ? "Online" : "COD"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-metric font-medium text-foreground whitespace-nowrap">
                    {formatNaira(orderDisplayAmount(order), { decimals: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === "pending_remittance" &&
                          onConfirmRemittance && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => onConfirmRemittance(order)}
                              className="h-8 text-xs gap-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Confirm received
                            </Button>
                          )}
                        {status === "collected" && onRelease && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onRelease(order)}
                            className="h-8 text-xs gap-1"
                          >
                            <ArrowUpCircle className="h-3.5 w-3.5" />
                            Release
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
