import { useEffect, useState } from "react";
import { fetchMonthlySummary, MonthlySummary } from "../../services/deliveries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useOrganization } from "../../contexts/OrganizationContext";
import { LottieLoader } from "../ui/LottieLoader";
import "./MonthlyWaybillSummary.css";

export function MonthlyWaybillSummary() {
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
  }, [selectedYear, currentOrganization]);

  const loadSummary = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchMonthlySummary(
        currentOrganization.id,
        selectedYear
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
    }),
    { waybilled: 0, delivered: 0, balance: 0 }
  );

  if (loading) {
    return (
      <div className="monthly-waybill-summary-loading">
        <LottieLoader />
      </div>
    );
  }

  if (error) {
    return <div className="monthly-waybill-summary-error">{error}</div>;
  }

  return (
    <div className="monthly-waybill-summary-container">
      <div className="monthly-waybill-summary-header">
        <div className="monthly-waybill-summary-header-content">
          <div className="monthly-waybill-summary-title-section">
            <div className="monthly-waybill-summary-icon">
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
              <h2 className="monthly-waybill-summary-title">
                Monthly Waybill Summary
              </h2>
              <p className="monthly-waybill-summary-subtitle">
                Track waybilled items from Lagos warehouse to other states vs
                delivered items
              </p>
            </div>
          </div>
          <div className="monthly-waybill-summary-year-selector">
            <label
              htmlFor="year-select"
              className="monthly-waybill-summary-year-label"
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

      <div className="monthly-waybill-summary-wrapper">
        <table className="monthly-waybill-summary-table">
          <thead>
            <tr>
              <th className="monthly-waybill-summary-header-cell">Month</th>
              <th className="monthly-waybill-summary-header-cell text-right">
                Waybilled
              </th>
              <th className="monthly-waybill-summary-header-cell text-right">
                Delivered
              </th>
              <th className="monthly-waybill-summary-header-cell text-right">
                BALANCE
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((month) => {
              return (
                <tr key={month.monthNumber}>
                  <td className="monthly-waybill-summary-cell monthly-waybill-summary-cell-medium">
                    {month.month}
                  </td>
                  <td className="monthly-waybill-summary-cell text-right">
                    {formatCurrency(month.waybilled)}
                  </td>
                  <td className="monthly-waybill-summary-cell text-right">
                    {formatCurrency(month.delivered)}
                  </td>
                  <td
                    className={`monthly-waybill-summary-cell text-right ${
                      month.balance > 0
                        ? "monthly-waybill-summary-balance-positive"
                        : month.balance < 0
                        ? "monthly-waybill-summary-balance-negative"
                        : ""
                    }`}
                  >
                    {formatCurrency(month.balance)}
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr className="monthly-waybill-summary-total-row">
              <td className="monthly-waybill-summary-cell monthly-waybill-summary-cell-medium">
                TOTAL
              </td>
              <td className="monthly-waybill-summary-cell text-right monthly-waybill-summary-cell-medium">
                {formatCurrency(totals.waybilled)}
              </td>
              <td className="monthly-waybill-summary-cell text-right monthly-waybill-summary-cell-medium">
                {formatCurrency(totals.delivered)}
              </td>
              <td
                className={`monthly-waybill-summary-cell text-right monthly-waybill-summary-cell-medium ${
                  totals.balance > 0
                    ? "monthly-waybill-summary-balance-positive"
                    : totals.balance < 0
                    ? "monthly-waybill-summary-balance-negative"
                    : ""
                }`}
              >
                {formatCurrency(totals.balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

