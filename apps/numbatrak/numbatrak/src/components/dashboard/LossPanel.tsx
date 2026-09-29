import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LucideIcon,
  AlertTriangle,
  TrendingDown,
  PackageX,
  Megaphone,
  Truck,
} from "lucide-react";
import {
  LossMetrics,
  EMPTY_LOSS_METRICS,
} from "../../services/dashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type BreakdownKey = "status" | "location" | "agent" | "product";

interface LossPanelProps {
  metrics: LossMetrics | null;
  loading?: boolean;
  formatCurrency: (value: number) => string;
}

export function LossPanel({
  metrics,
  loading,
  formatCurrency,
}: LossPanelProps) {
  const m = metrics ?? EMPTY_LOSS_METRICS;

  const breakdownOptions = useMemo(
    () =>
      (
        [
          { key: "status", label: "By status", count: m.byStatus.length },
          { key: "location", label: "By location", count: m.byLocation.length },
          { key: "agent", label: "By agent", count: m.byAgent.length },
          { key: "product", label: "By product", count: m.byProduct.length },
        ] satisfies { key: BreakdownKey; label: string; count: number }[]
      ).filter((o) => o.count > 0),
    [m.byStatus.length, m.byLocation.length, m.byAgent.length, m.byProduct.length]
  );

  const [activeBreakdown, setActiveBreakdown] = useState<BreakdownKey | null>(null);

  useEffect(() => {
    if (activeBreakdown && !breakdownOptions.some((o) => o.key === activeBreakdown)) {
      setActiveBreakdown(null);
    }
  }, [activeBreakdown, breakdownOptions]);

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

  if (
    m.undeliveredCount === 0 &&
    m.failedDeliveryCost === 0 &&
    m.byStatus.length === 0
  ) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          What you&apos;re losing
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Undelivered orders in the selected period and related costs
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LossStat
            icon={PackageX}
            label="Undelivered orders"
            value={m.undeliveredCount.toLocaleString()}
          />
          <LossStat
            icon={TrendingDown}
            label="Would-be sales"
            value={formatCurrency(m.wouldBeSales)}
          />
          <LossStat
            icon={Megaphone}
            label="Allocated ad spend"
            value={formatCurrency(m.allocatedAdSpend)}
            hint="Estimated"
          />
          <LossStat
            icon={Truck}
            label="Failed delivery cost"
            value={formatCurrency(m.failedDeliveryCost)}
          />
        </div>

        {breakdownOptions.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {breakdownOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setActiveBreakdown((prev) => (prev === option.key ? null : option.key))
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    activeBreakdown === option.key
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {activeBreakdown === "status" && (
              <div className="mt-3">
                <LossBreakdownSection title="By status">
                  {m.byStatus.map((row) => (
                    <LossBreakdownRow
                      key={row.status}
                      label={row.label}
                      count={row.count}
                      amount={formatCurrency(row.wouldBeSales)}
                    />
                  ))}
                </LossBreakdownSection>
              </div>
            )}

            {activeBreakdown === "location" && (
              <div className="mt-3">
                <LossBreakdownSection title="By location">
                  {m.byLocation.map((row) => (
                    <LossBreakdownRow
                      key={row.location}
                      label={row.label}
                      count={row.count}
                      amount={formatCurrency(row.wouldBeSales)}
                    />
                  ))}
                </LossBreakdownSection>
              </div>
            )}

            {activeBreakdown === "agent" && (
              <div className="mt-3">
                <LossBreakdownSection title="By agent">
                  {m.byAgent.map((row) => (
                    <LossBreakdownRow
                      key={row.agentId ?? "unassigned"}
                      label={row.label}
                      count={row.count}
                      amount={formatCurrency(row.wouldBeSales)}
                    />
                  ))}
                </LossBreakdownSection>
              </div>
            )}

            {activeBreakdown === "product" && (
              <div className="mt-3">
                <LossBreakdownSection
                  title="Cost of failed orders by product"
                  subtitle="Undelivered units × average delivered sale price"
                >
                  {m.byProduct.map((row) => (
                    <LossBreakdownRow
                      key={row.productId}
                      label={row.productName}
                      count={`${row.undeliveredQuantity} units`}
                      amount={formatCurrency(row.costOfFailedOrders)}
                      title={
                        row.averageSalesPrice === 0
                          ? "No delivered sales this period - price basis unavailable"
                          : `${row.undeliveredQuantity} undelivered × ${formatCurrency(row.averageSalesPrice)} avg`
                      }
                    />
                  ))}
                </LossBreakdownSection>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LossBreakdownSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function LossBreakdownRow({
  label,
  count,
  amount,
  title,
}: {
  label: string;
  count: number | string;
  amount: string;
  title?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-3 py-2 text-sm bg-background"
      title={title}
    >
      <span className="font-medium text-foreground truncate">{label}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-muted-foreground">{count}</span>
        <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">{amount}</span>
      </div>
    </div>
  );
}

function LossStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
        {hint && (
          <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
            ({hint})
          </span>
        )}
      </div>
      <p className="text-xl font-semibold text-foreground font-metric">{value}</p>
    </div>
  );
}
