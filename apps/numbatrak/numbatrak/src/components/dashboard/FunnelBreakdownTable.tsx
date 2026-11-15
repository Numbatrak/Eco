import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  fetchFunnelBreakdown,
  type DashboardMetricsScope,
  type FunnelBreakdownRow,
} from "../../services/dashboardMetrics";
import { resolveDateRange, type DateFilter } from "../../utils/dateRange";

const NO_VALUE = "\u2014";

interface Props {
  organizationId: string;
  dateFilter?: DateFilter;
  scope: DashboardMetricsScope;
  formatCurrency: (value: number) => string;
}

/**
 * "Per funnel / offer / platform" from the dashboard spec: delivered orders
 * grouped by the media buyer + platform + offer a tracking link stamps on
 * each order.
 *
 * Defaults to delivered orders, so revenue and profit mean money that
 * actually landed; an explicit status filter overrides that. The endpoint
 * deliberately ignores the platform/buyer filters (they're the dimensions
 * being compared), so those are applied here to keep the table in step with
 * the rest of the dashboard.
 *
 * Spend comes from ad spend recorded against a tracking link (Media Buyers
 * -> ad spend); spend not tied to a link can't be credited to a buyer, so it
 * isn't in these rows. Profit here is after that spend.
 */
export function FunnelBreakdownTable({ organizationId, dateFilter, scope, formatCurrency }: Props) {
  const [rows, setRows] = useState<FunnelBreakdownRow[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const { platform, mediaBuyerName, ...serverScope } = scope;
  const status = serverScope.status ?? "delivered";
  const scopeKey = JSON.stringify({ ...serverScope, status });

  useEffect(() => {
    let cancelled = false;
    const { startDate, endDate } = resolveDateRange(dateFilter);
    setError(false);
    setRows(null);
    fetchFunnelBreakdown(organizationId, startDate, endDate, { ...serverScope, status })
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((err) => {
        console.error("Error loading funnel breakdown:", err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // scopeKey stands in for serverScope + status, which are rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, dateFilter, scopeKey, reloadToken]);

  const visible = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => (!platform || r.platform === platform) && (!mediaBuyerName || r.mediaBuyerName === mediaBuyerName))
        .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.revenue - a.revenue),
    [rows, platform, mediaBuyerName],
  );

  const countLabel = status === "delivered" ? "Deliv." : "Orders";
  const anySpend = visible.some((r) => (r.spend ?? 0) > 0);

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-foreground">Per buyer / platform / offer</h2>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {status === "delivered" ? "delivered orders" : `status: ${status}`} · follows filters
        </span>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 text-sm text-muted-foreground">
          Couldn&apos;t load this breakdown. The figures are unknown, not zero.
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : rows == null ? (
        <div className="mx-4 mb-4 h-24 animate-pulse rounded-lg bg-muted" />
      ) : visible.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          No orders from tracking links in this period. Orders show up here once they come in through a
          tracking link.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Buyer · Platform · Offer</th>
                <th className="px-4 py-2 text-right font-medium">Spend</th>
                <th className="px-4 py-2 text-right font-medium">{countLabel}</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
                <th className="px-4 py-2 text-right font-medium" title="Spend ÷ orders in this row">
                  {status === "delivered" ? "Real CPA" : "CPA"}
                </th>
                <th className="px-4 py-2 text-right font-medium" title="Revenue ÷ spend">ROAS</th>
                <th className="px-4 py-2 text-right font-medium" title="Order profit (revenue − product cost − delivery) minus spend">
                  Profit after ads
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const spend = row.spend ?? 0;
                const profitAfterAds = row.profit - spend;
                return (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">
                      {row.mediaBuyerName} · {row.platform} · {row.offerLabel ?? "Whole form"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {spend > 0 ? formatCurrency(spend) : NO_VALUE}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{row.orderCount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {spend > 0 && row.orderCount > 0 ? formatCurrency(spend / row.orderCount) : NO_VALUE}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                      {spend > 0 ? `${(row.revenue / spend).toFixed(1)}×` : NO_VALUE}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        profitAfterAds < 0 ? "text-danger-text" : "text-primary-text"
                      }`}
                    >
                      {formatCurrency(profitAfterAds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!anySpend && (
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              No ad spend recorded against these tracking links in this period. Record it under Media Buyers →
              ad spend, picking the tracking link, to fill in spend, CPA and ROAS.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
