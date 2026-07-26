import { useState, Fragment } from "react";
import {
  WalletRemittanceLine,
  RemittanceLineStatus,
} from "../../types/wallet";
import { formatNaira } from "../../utils/currency";
import { Button } from "../ui/button";
import { Check, MinusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { LoadingState } from "../ui/LoadingState";

const STATUS_LABELS: Record<RemittanceLineStatus, string> = {
  standing: "Standing",
  remitted: "Remitted",
  short: "Short",
  net_owed: "Net owed to agent",
};

const STATUS_CLASS: Record<RemittanceLineStatus, string> = {
  standing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  remitted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  short: "bg-red-500/10 text-red-700 dark:text-red-400",
  net_owed: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

interface WalletRemittanceTableProps {
  lines: WalletRemittanceLine[];
  loading?: boolean;
  canManage?: boolean;
  onMarkRemitted?: (line: WalletRemittanceLine) => void;
  onAddNetOff?: (line: WalletRemittanceLine) => void;
  actionKey?: string | null;
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function WalletRemittanceTable({
  lines,
  loading,
  canManage,
  onMarkRemitted,
  onAddNetOff,
  actionKey,
}: WalletRemittanceTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <LoadingState label="Loading remittance lines…" size="sm" className="py-4" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
        No agent-collected deliveries in this period. Lines appear when orders
        are marked delivered with money received by the agent.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-8 px-2 py-3" />
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Agent / day
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Delivered
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Fees kept
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Net-off
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Expected
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                Actual
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
            {lines.map((line, index) => {
              const busy = actionKey === line.lineKey;
              const isOpen = expanded === line.lineKey;
              return (
                <Fragment key={line.lineKey}>
                  <tr
                    className={`border-b border-border ${
                      index % 2 === 0 ? "" : "bg-muted/20"
                    }`}
                  >
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isOpen ? null : line.lineKey)
                        }
                        className="p-1 text-muted-foreground hover:text-foreground"
                        aria-label={isOpen ? "Collapse orders" : "Expand orders"}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {line.agent_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(line.remittance_date)} · {line.order_count}{" "}
                        order{line.order_count === 1 ? "" : "s"}
                      </div>
                      {line.sub_brands.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {line.sub_brands.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-metric whitespace-nowrap">
                      {formatNaira(line.total_delivered_value, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-metric text-muted-foreground whitespace-nowrap hidden md:table-cell">
                      −{formatNaira(line.total_delivery_fees, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-metric text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {line.net_off_amount > 0
                        ? `−${formatNaira(line.net_off_amount, { decimals: 0 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-metric font-medium whitespace-nowrap">
                      {formatNaira(line.expected_remittance, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right font-metric whitespace-nowrap">
                      {line.actual_amount != null
                        ? formatNaira(line.actual_amount, { decimals: 0 })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[line.status]}`}
                      >
                        {STATUS_LABELS[line.status]}
                      </span>
                      {line.status === "short" && line.shortfall > 0 && (
                        <div className="text-xs text-red-500 mt-0.5">
                          Short {formatNaira(line.shortfall, { decimals: 0 })}
                        </div>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {(line.status === "standing" ||
                            line.status === "short" ||
                            line.status === "net_owed") &&
                            onMarkRemitted && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => onMarkRemitted(line)}
                                className="h-8 text-xs gap-1"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Mark remitted
                              </Button>
                            )}
                          {onAddNetOff && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => onAddNetOff(line)}
                              className="h-8 text-xs gap-1"
                            >
                              <MinusCircle className="h-3.5 w-3.5" />
                              Net-off
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/10">
                      <td colSpan={canManage ? 9 : 8} className="px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Orders in this line
                        </p>
                        <ul className="text-xs space-y-1">
                          {line.orders.map((o) => (
                            <li
                              key={`${o.source}-${o.id}`}
                              className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground"
                            >
                              <span className="text-foreground font-medium">
                                {o.customer_name || "Customer"}
                              </span>
                              <span>
                                {formatNaira(o.delivered_value, { decimals: 0 })}
                              </span>
                              <span>
                                fee{" "}
                                {formatNaira(o.delivery_fee, { decimals: 0 })}
                              </span>
                              {o.sub_brand && <span>{o.sub_brand}</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Expected = delivered value − delivery fees (agent
                          keeps) − net-offs
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
