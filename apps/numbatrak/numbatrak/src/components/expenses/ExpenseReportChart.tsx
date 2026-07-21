import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BRAND_CHART } from "../../brand/tokens";
import { MonthlyExpensePoint } from "../services/expenseSummary";
import { LoadingState } from "../ui/LoadingState";

const axisProps = {
  stroke: BRAND_CHART.coolGray,
  tick: {
    fill: BRAND_CHART.coolGray,
    fontSize: 11,
    fontFamily: "DM Mono, monospace",
  },
};

interface ExpenseReportChartProps {
  data: MonthlyExpensePoint[];
  loading?: boolean;
}

export function ExpenseReportChart({ data, loading }: ExpenseReportChartProps) {
  if (loading) {
    return <LoadingState label="Loading expense report…" className="py-12" />;
  }

  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12 rounded-xl border border-dashed border-border">
        No expense data in the selected period.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 font-semibold text-foreground">Expenses over time</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Stacked by category (org + agent operational costs)
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString("en-NG", {
                style: "currency",
                currency: "NGN",
                maximumFractionDigits: 0,
              })
            }
            contentStyle={{
              backgroundColor: BRAND_CHART.deepNavy,
              border: `1px solid ${BRAND_CHART.coolGray}`,
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend />
          <Bar
            dataKey="operational"
            stackId="exp"
            fill={BRAND_CHART.softEmerald}
            name="Operational"
          />
          <Bar
            dataKey="building"
            stackId="exp"
            fill={BRAND_CHART.coolGray}
            name="Building"
          />
          <Bar
            dataKey="marketing"
            stackId="exp"
            fill="#6366f1"
            name="Marketing"
          />
          <Bar
            dataKey="advertising"
            stackId="exp"
            fill={BRAND_CHART.emerald}
            name="Advertising"
          />
          <Bar dataKey="agent" stackId="exp" fill="#f59e0b" name="Agent costs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
