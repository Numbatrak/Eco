import { useEffect, useState } from "react";
import {
  fetchMonthlySummary,
  MonthlySummary,
  MonthlySummaryQueryOptions,
} from "../../services/deliveries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useOrganization } from "../../contexts/OrganizationContext";
import "./MonthlySummaryTable.css";
import { LoadingState } from "../ui/LoadingState";

export function MonthlySummaryTable({
  queryOptions,
}: {
  queryOptions?: MonthlySummaryQueryOptions;
}) {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );

  useEffect(() => {
    if (currentOrganization) {
      loadSummary();
    }
  }, [selectedYear, currentOrganization, queryOptions]);

  const loadSummary = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchMonthlySummary(
        currentOrganization.id,
        selectedYear,
        queryOptions
      );
      setSummary(data);
    } catch (err) {
      console.error("Error loading monthly summary:", err);
      setError("Failed to load monthly summary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate totals
  const totals = summary.reduce(
    (acc, month) => ({
      waybilled: acc.waybilled + month.waybilled,
      delivered: acc.delivered + month.delivered,
      balance: acc.balance + month.balance,
      waybill_fee: acc.waybill_fee + month.waybill_fee,
    }),
    { waybilled: 0, delivered: 0, balance: 0, waybill_fee: 0 }
  );

  if (loading) {
    return (
      <div className="monthly-summary-table-loading-container">
        <LoadingState label="Loading monthly summary…" size="md" className="py-8" />
      </div>
    );
  }

  if (error) {
    return <div className="monthly-summary-table-error-container">{error}</div>;
  }

  return (
    <div className="monthly-summary-table-container">
      <div className="monthly-summary-table-header">
        <div className="monthly-summary-table-header-content">
          <div className="monthly-summary-table-title-section">
            <div className="monthly-summary-table-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="monthly-summary-table-title">Summary by month</h2>
              <p className="monthly-summary-table-subtitle">
                Balance = waybilled − delivered. Negative values are normal
                when pre-system stock is delivered.
              </p>
            </div>
          </div>
          <div className="monthly-summary-table-year-selector">
            <label
              htmlFor="year-select"
              className="monthly-summary-table-year-label"
            >
              Year:
            </label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger id="year-select" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="monthly-summary-table-wrapper">
        <table className="monthly-summary-table">
          <thead>
            <tr>
              <th className="monthly-summary-table-header-cell">Month</th>
              <th className="monthly-summary-table-header-cell text-right">
                Waybilled
              </th>
              <th className="monthly-summary-table-header-cell text-right">
                Delivered
              </th>
              <th className="monthly-summary-table-header-cell text-right">
                Balance
              </th>
              <th className="monthly-summary-table-header-cell text-right">
                Waybill Fee
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((month, index) => {
              return (
                <tr key={month.monthNumber}>
                  <td className="monthly-summary-table-cell monthly-summary-table-cell-medium">
                    {month.month}
                  </td>
                  <td className="monthly-summary-table-cell text-right">
                    {formatCurrency(month.waybilled)}
                  </td>
                  <td className="monthly-summary-table-cell text-right">
                    {formatCurrency(month.delivered)}
                  </td>
                  <td className="monthly-summary-table-cell text-right monthly-summary-table-balance">
                    {formatCurrency(month.balance)}
                  </td>
                  <td className="monthly-summary-table-cell text-right">
                    {formatCurrency(month.waybill_fee)}
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr className="total-row">
              <td className="monthly-summary-table-cell monthly-summary-table-cell-medium">
                TOTAL
              </td>
              <td className="monthly-summary-table-cell text-right monthly-summary-table-cell-medium">
                {formatCurrency(totals.waybilled)}
              </td>
              <td className="monthly-summary-table-cell text-right monthly-summary-table-cell-medium">
                {formatCurrency(totals.delivered)}
              </td>
              <td className="monthly-summary-table-cell text-right monthly-summary-table-cell-medium monthly-summary-table-balance">
                {formatCurrency(totals.balance)}
              </td>
              <td className="monthly-summary-table-cell text-right monthly-summary-table-cell-medium">
                {formatCurrency(totals.waybill_fee)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
