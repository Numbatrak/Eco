import { KPICard } from "../KPICard";
import { WalletSummary } from "../../types/wallet";
import { formatNaira } from "../../utils/currency";
import {
  Banknote,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Truck,
} from "lucide-react";

interface WalletSummaryCardsProps {
  summary: WalletSummary;
  loading?: boolean;
}

export function WalletSummaryCards({
  summary,
  loading,
}: WalletSummaryCardsProps) {
  const placeholder = loading ? "…" : formatNaira(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Delivered value"
          value={
            loading
              ? placeholder
              : formatNaira(summary.totalDeliveredValue, { decimals: 0 })
          }
          subtitle={`${summary.orderCount} order${summary.orderCount === 1 ? "" : "s"} · agent collected`}
          icon={TrendingUp}
          color="indigo"
        />
        <KPICard
          title="Expected remittance"
          value={
            loading
              ? placeholder
              : formatNaira(summary.totalExpectedRemittance, { decimals: 0 })
          }
          subtitle="After delivery fees & net-offs"
          icon={Banknote}
          color="teal"
        />
        <KPICard
          title="Remitted"
          value={
            loading
              ? placeholder
              : formatNaira(summary.totalRemitted, { decimals: 0 })
          }
          subtitle={`${summary.remittedCount} line${summary.remittedCount === 1 ? "" : "s"} cleared`}
          icon={CheckCircle2}
          color="green"
        />
        <KPICard
          title="Cash gap (outstanding)"
          value={
            loading
              ? placeholder
              : formatNaira(summary.cashGapOutstanding, { decimals: 0 })
          }
          subtitle={`${summary.standingCount} standing · ${summary.shortCount} short`}
          icon={summary.cashGapOutstanding > 0 ? AlertTriangle : Clock}
          color={summary.cashGapOutstanding > 0 ? "red" : "amber"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Delivery fees (agents keep)
            </p>
            <p className="font-metric text-xl font-semibold text-foreground mt-1">
              {loading
                ? "…"
                : formatNaira(summary.totalDeliveryFees, { decimals: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Not re-booked as expense — read from orders
            </p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Remittance lines</p>
            <p className="font-metric text-xl font-semibold text-foreground mt-1">
              {loading ? "…" : summary.lineCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              One line per agent per day
            </p>
          </div>
          <div className="p-3 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Banknote className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
