import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import {
  fetchAccountingReport,
  fetchSubBrands,
  type AccountingReport,
} from "../../services/accounting";

function currency(v: number): string {
  return `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function AccountingPage() {
  const { currentOrganization } = useOrganization();

  const [report, setReport] = useState<AccountingReport | null>(null);
  const [subBrands, setSubBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subBrand, setSubBrand] = useState("");
  const [tab, setTab] = useState<"pnl" | "cash">("pnl");

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [r, sb] = await Promise.all([
        fetchAccountingReport({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          subBrand: subBrand || undefined,
        }),
        fetchSubBrands(),
      ]);
      setReport(r);
      setSubBrands(sb);
    } catch (e) {
      console.error("Failed to load accounting", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, dateFrom, dateTo, subBrand]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "pnl", label: "Profit & Loss" },
    { key: "cash", label: "Cash Position" },
  ];

  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Accounting</h1>
          <p className="text-sm text-muted-foreground">Financial summary: revenue, expenses, and net profit</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-2 py-1 text-sm bg-background" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-2 py-1 text-sm bg-background" />
          </div>
          {subBrands.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1">Sub-Brand</label>
              <select value={subBrand} onChange={(e) => setSubBrand(e.target.value)} className="border rounded px-2 py-1 text-sm bg-background">
                <option value="">All</option>
                {subBrands.map((sb) => (
                  <option key={sb} value={sb}>{sb}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !report ? (
          <p className="text-muted-foreground">No data available</p>
        ) : tab === "pnl" ? (
          <PnLView report={report} />
        ) : (
          <CashView report={report} />
        )}
      </div>
    </PageLayout>
  );
}

function PnLView({ report }: { report: AccountingReport }) {
  const { pnl } = report;
  const brandEntries = Object.entries(pnl.revenue.by_sub_brand).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Revenue" value={currency(pnl.revenue.total)} />
        <MetricCard label="COGS" value={currency(pnl.cogs)} />
        <MetricCard label="Gross Profit" value={currency(pnl.gross_profit)} />
        <MetricCard label="Net Profit" value={currency(pnl.net_profit)} className={pnl.net_profit < 0 ? "text-red-600" : "text-green-600"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard label="Orders Delivered" value={pnl.order_count.toLocaleString()} />
        <MetricCard label="Avg Order Value" value={currency(pnl.avg_order_value)} />
        <MetricCard label="Profit Margin" value={pct(pnl.profit_margin)} className={pnl.profit_margin < 0 ? "text-red-600" : ""} />
      </div>

      {/* Expense Breakdown */}
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Expense Breakdown</h3>
        <div className="space-y-2">
          <ExpenseRow label="Operational" amount={pnl.expenses.operational} total={pnl.expenses.total} />
          <ExpenseRow label="Building" amount={pnl.expenses.building} total={pnl.expenses.total} />
          <ExpenseRow label="Marketing" amount={pnl.expenses.marketing} total={pnl.expenses.total} />
          <ExpenseRow label="Advertising" amount={pnl.expenses.advertising} total={pnl.expenses.total} />
          <ExpenseRow label="Agent" amount={pnl.expenses.agent} total={pnl.expenses.total} />
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total Expenses</span>
            <span>{currency(pnl.expenses.total)}</span>
          </div>
        </div>
      </div>

      {/* Revenue by Sub-Brand */}
      {brandEntries.length > 1 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Revenue by Sub-Brand</h3>
          <div className="space-y-2">
            {brandEntries.map(([brand, amount]) => (
              <div key={brand} className="flex justify-between text-sm">
                <span>{brand}</span>
                <span>{currency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CashView({ report }: { report: AccountingReport }) {
  const { cash_position } = report;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Earned" value={currency(cash_position.total_earned)} />
        <MetricCard label="Total Collected" value={currency(cash_position.total_collected)} />
        <MetricCard label="Outstanding COD" value={currency(cash_position.outstanding_cod)} className={cash_position.outstanding_cod > 0 ? "text-amber-600" : ""} />
        <MetricCard label="Collection Rate" value={pct(cash_position.collection_rate)} />
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Cash Flow Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Revenue from delivered orders</span>
            <span className="font-medium">{currency(cash_position.total_earned)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cash collected (prepaid + remitted COD)</span>
            <span className="font-medium text-green-600">{currency(cash_position.total_collected)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium">Outstanding (agent-held COD pending remittance)</span>
            <span className="font-semibold text-amber-600">{currency(cash_position.outstanding_cod)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${className ?? ""}`}>{value}</p>
    </div>
  );
}

function ExpenseRow({ label, amount, total }: { label: string; amount: number; total: number }) {
  const share = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
      <span className="w-24 text-right">{currency(amount)}</span>
      <span className="w-12 text-right text-muted-foreground">{pct(share)}</span>
    </div>
  );
}
