import { useEffect, useState } from "react";
import {
  fetchMonthlyExpenseSummary,
  type MonthlyExpenseSummary,
} from "../../services/expenses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useOrganization } from "../../contexts/OrganizationContext";
import { ChevronDown, ChevronUp } from "lucide-react";
import "./MonthlyExpenseSummary.css";
import { LoadingState } from "../ui/LoadingState";

export function MonthlyExpenseSummary() {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<MonthlyExpenseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [showAllMonths, setShowAllMonths] = useState(false);

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
      const data = await fetchMonthlyExpenseSummary(
        currentOrganization.id,
        selectedYear
      );
      setSummary(data);
    } catch (err) {
      console.error("Error loading monthly expense summary:", err);
      setError("Failed to load monthly summary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      total: acc.total + month.total,
    }),
    { total: 0 }
  );

  // Get all unique categories
  const allCategories = new Set<string>();
  summary.forEach((month) => {
    Object.keys(month.categoryBreakdown).forEach((cat) =>
      allCategories.add(cat)
    );
  });
  const categories = Array.from(allCategories).sort();

  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Get current month number (1-12)
  const currentMonthNumber = new Date().getMonth() + 1;

  // Filter summary to show only current month by default
  const displayedSummary = showAllMonths
    ? summary
    : summary.filter((month) => month.monthNumber === currentMonthNumber);

  // Reset showAllMonths when year changes
  useEffect(() => {
    setShowAllMonths(false);
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="monthly-expense-summary-loading-container">
        <LoadingState label="Loading monthly summary…" size="md" className="py-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="monthly-expense-summary-error-container">{error}</div>
    );
  }

  return (
    <div className="monthly-expense-summary-container">
      <div className="monthly-expense-summary-header">
        <div className="monthly-expense-summary-header-content">
          <div className="monthly-expense-summary-title-section">
            <div className="monthly-expense-summary-icon">
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
              <h2 className="monthly-expense-summary-title">
                Monthly Expense Summary
              </h2>
              <p className="monthly-expense-summary-subtitle">
                Expenses by month and category
              </p>
            </div>
          </div>
          <div className="monthly-expense-summary-header-controls">
            <div className="monthly-expense-summary-year-selector">
              <label
                htmlFor="year-select-expense"
                className="monthly-expense-summary-year-label"
              >
                Year:
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year-select-expense" className="w-32">
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
            {summary.length > 0 && (
              <button
                onClick={() => setShowAllMonths(!showAllMonths)}
                className="monthly-expense-summary-toggle-button"
                title={
                  showAllMonths ? "Show current month only" : "Show all months"
                }
              >
                {showAllMonths ? (
                  <>
                    <ChevronUp className="monthly-expense-summary-toggle-icon" />
                    <span>Show Current Month</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="monthly-expense-summary-toggle-icon" />
                    <span>Show All</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="monthly-expense-summary-wrapper">
        <table className="monthly-expense-summary-table">
          <thead>
            <tr>
              <th className="monthly-expense-summary-header-cell">Month</th>
              {categories.map((category) => (
                <th
                  key={category}
                  className="monthly-expense-summary-header-cell text-right"
                >
                  {category}
                </th>
              ))}
              <th className="monthly-expense-summary-header-cell text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedSummary.length === 0 ? (
              <tr>
                <td
                  colSpan={categories.length + 2}
                  className="monthly-expense-summary-empty-value"
                  style={{ textAlign: "center", padding: "32px" }}
                >
                  No expenses found for the selected period.
                </td>
              </tr>
            ) : (
              <>
                {displayedSummary.map((month) => (
                  <tr key={month.monthNumber}>
                    <td className="monthly-expense-summary-cell monthly-expense-summary-cell-medium">
                      {month.month}
                    </td>
                    {categories.map((category) => (
                      <td
                        key={category}
                        className="monthly-expense-summary-cell text-right"
                      >
                        {month.categoryBreakdown[category] ? (
                          formatCurrency(month.categoryBreakdown[category])
                        ) : (
                          <span className="monthly-expense-summary-empty-value">
                            N/A
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="monthly-expense-summary-cell text-right monthly-expense-summary-cell-semibold">
                      {formatCurrency(month.total)}
                    </td>
                  </tr>
                ))}
                {/* Total Row - only show when showing all months */}
                {showAllMonths && (
                  <tr className="total-row">
                    <td className="monthly-expense-summary-cell monthly-expense-summary-cell-medium">
                      TOTAL
                    </td>
                    {categories.map((category) => {
                      const categoryTotal = summary.reduce(
                        (sum, month) =>
                          sum + (month.categoryBreakdown[category] || 0),
                        0
                      );
                      return (
                        <td
                          key={category}
                          className="monthly-expense-summary-cell text-right monthly-expense-summary-cell-medium"
                        >
                          {categoryTotal > 0 ? (
                            formatCurrency(categoryTotal)
                          ) : (
                            <span className="monthly-expense-summary-empty-value">
                              N/A
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="monthly-expense-summary-cell text-right monthly-expense-summary-cell-medium">
                      {formatCurrency(totals.total)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
