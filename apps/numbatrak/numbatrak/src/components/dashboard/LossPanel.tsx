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

        {m.byStatus.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              By status
            </p>
            <div className="flex flex-wrap gap-2">
              {m.byStatus.map((row) => (
                <span
                  key={row.status}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border bg-background"
                >
                  <span className="font-medium text-foreground">
                    {row.label}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{row.count}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {formatCurrency(row.wouldBeSales)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
