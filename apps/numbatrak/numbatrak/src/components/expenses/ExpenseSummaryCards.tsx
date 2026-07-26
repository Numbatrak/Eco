import {
  EXPENSE_CATEGORY_META,
  ORG_EXPENSE_CATEGORY_IDS,
  OrgExpenseCategory,
} from "../../constants/expenseCategories";
import { ExpenseSummary } from "../../services/expenseSummary";

function formatNgn(value: number) {
  return value.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatRoas(value: number) {
  return value > 0 ? `${value.toFixed(2)}×` : "N/A";
}

interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary;
  loading?: boolean;
}

export function ExpenseSummaryCards({
  summary,
  loading,
}: ExpenseSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 animate-pulse min-h-[6.5rem]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {ORG_EXPENSE_CATEGORY_IDS.map((id: OrgExpenseCategory) => {
          const meta = EXPENSE_CATEGORY_META[id];
          return (
            <div
              key={id}
              className="rounded-xl border border-border bg-card p-4 space-y-1"
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {meta.label}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatNgn(summary.byCategory[id])}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground uppercase">Total expenses</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatNgn(summary.totalExpenses)}
          </p>
          <p className="text-xs text-muted-foreground">
            Org {formatNgn(summary.totalOrgExpenses)} · Agent{" "}
            {formatNgn(summary.totalAgentExpenses)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground uppercase">% of revenue</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatPct(summary.expensePercentOfRevenue)}
          </p>
          <p className="text-xs text-muted-foreground">
            Delivered revenue {formatNgn(summary.deliveredRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground uppercase">Advertising ROAS</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatRoas(summary.advertisingRoas)}
          </p>
          <p className="text-xs text-muted-foreground">
            Ad spend {formatNgn(summary.advertisingSpend)} (isolated)
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground uppercase">Non-ad org costs</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatNgn(summary.nonAdvertisingOrgExpenses)}
          </p>
          <p className="text-xs text-muted-foreground">
            Operational + building + marketing
          </p>
        </div>
      </div>
    </div>
  );
}
