import { type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  LossMetrics,
  EMPTY_LOSS_METRICS,
} from "../../services/dashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface LossPanelProps {
  metrics: LossMetrics | null;
  loading?: boolean;
  /** True when the fetch failed. Distinct from "no losses" — see the render below. */
  error?: boolean;
  onRetry?: () => void;
  formatCurrency: (value: number) => string;
  /** Orders generated in the same scope, for the "96 / 246" headline. */
  totalOrdersGenerated?: number | null;
}

/** How many rows each breakdown column shows before "+N more". */
const TOP_ROWS = 4;

export function LossPanel({
  metrics,
  loading,
  error,
  onRetry,
  formatCurrency,
  totalOrdersGenerated,
}: LossPanelProps) {
  const m = metrics ?? EMPTY_LOSS_METRICS;

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-foreground">Couldn&apos;t load what you&apos;re losing</p>
            <p className="text-sm text-muted-foreground">
              These figures are unknown, not zero.
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (
    m.undeliveredCount === 0 &&
    m.failedDeliveryCost === 0 &&
    m.byStatus.length === 0
  ) {
    return null;
  }

  // Ad spend burnt on these orders plus what the failed deliveries cost, per
  // undelivered order - the true price of each order that didn't land.
  const realCostPerFailed =
    m.undeliveredCount > 0 ? (m.allocatedAdSpend + m.failedDeliveryCost) / m.undeliveredCount : null;
  const shareOf = (count: number) =>
    m.undeliveredCount > 0 ? `${Math.round((count / m.undeliveredCount) * 100)}%` : "\u2014";

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          What you&apos;re losing
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Orders that didn&apos;t deliver in the selected period, and what they cost. Follows every filter.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <LossStat
            label="orders not delivered"
            value={
              totalOrdersGenerated
                ? `${m.undeliveredCount.toLocaleString()} / ${totalOrdersGenerated.toLocaleString()}`
                : m.undeliveredCount.toLocaleString()
            }
            danger
          />
          <LossStat label="would-be sales" value={formatCurrency(m.wouldBeSales)} />
          <LossStat label="ad spend on them" value={formatCurrency(m.allocatedAdSpend)} estimated />
          <LossStat label="failed-delivery cost" value={formatCurrency(m.failedDeliveryCost)} />
          <LossStat
            label="real cost per failed order"
            value={realCostPerFailed == null ? "\u2014" : formatCurrency(realCostPerFailed)}
            title="(ad spend on them + failed-delivery cost) ÷ orders not delivered"
            danger
          />
        </div>

        {/* auto-fit: four columns as in the spec, five when products are present. */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LossBreakdownColumn
            title="By location"
            rows={m.byLocation.map((r) => ({
              key: r.location,
              label: r.label,
              value: shareOf(r.count),
              title: `${r.count} orders · ${formatCurrency(r.wouldBeSales)} would-be sales`,
            }))}
          />
          <LossBreakdownColumn
            title="By agent"
            rows={m.byAgent.map((r) => ({
              key: String(r.agentId ?? "unassigned"),
              label: r.label,
              value: shareOf(r.count),
              title: `${r.count} orders · ${formatCurrency(r.wouldBeSales)} would-be sales`,
            }))}
          />
          <LossBreakdownColumn
            title="By funnel"
            rows={(m.byFunnel ?? []).map((r) => ({
              key: r.formId ?? "no-form",
              label: r.label,
              value: shareOf(r.count),
              title: `${r.count} orders · ${formatCurrency(r.wouldBeSales)} would-be sales`,
            }))}
          />
          <LossBreakdownColumn
            title="By reason"
            rows={m.byStatus.map((r) => ({
              key: r.status,
              label: r.label,
              value: r.count.toLocaleString(),
              title: `${formatCurrency(r.wouldBeSales)} would-be sales`,
            }))}
          />
          {m.byProduct.length > 0 && (
          <LossBreakdownColumn
            title="By product"
            rows={m.byProduct.map((r) => ({
              key: r.productId,
              label: r.productName,
              value: formatCurrency(r.costOfFailedOrders),
              title:
                r.averageSalesPrice === 0
                  ? `${r.undeliveredQuantity} units · no delivered sales this period, so no price basis`
                  : `${r.undeliveredQuantity} undelivered units × ${formatCurrency(r.averageSalesPrice)} average price`,
            }))}
          />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LossBreakdownColumn({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: ReactNode; title?: string }[];
}) {
  const shown = rows.slice(0, TOP_ROWS);
  const hidden = rows.length - shown.length;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing to show</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 text-sm" title={row.title}>
              <span className="truncate text-foreground/80">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">+{hidden} more</p>}
    </div>
  );
}

function LossStat({
  label,
  value,
  estimated,
  danger,
  title,
}: {
  label: string;
  value: string;
  estimated?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center" title={title}>
      <p className={`text-lg font-semibold tabular-nums ${danger ? "text-danger-text" : "text-foreground"}`}>
        {value}
        {estimated && (
          <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-warn-text">est</span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
