import { useMemo } from "react";
import { AgentExpenseWithRelations } from "../../types/expense";
import { Trophy, TrendingUp } from "lucide-react";
import "./AgentExpenseLeaderboard.css";
import { LoadingState } from "../ui/LoadingState";

interface AgentExpenseLeaderboardProps {
  expenses: AgentExpenseWithRelations[];
  loading?: boolean;
}

interface AgentLeaderboardEntry {
  agentId: number | null;
  agentName: string;
  totalCost: number;
  topCategory: string;
  topCategoryAmount: number;
  expenseCount: number;
}

export function AgentExpenseLeaderboard({
  expenses,
  loading = false,
}: AgentExpenseLeaderboardProps) {
  const leaderboardData = useMemo(() => {
    // Group expenses by agent
    const agentMap = new Map<
      number | null,
      {
        name: string;
        expenses: AgentExpenseWithRelations[];
        categoryTotals: Record<string, number>;
      }
    >();

    expenses.forEach((expense) => {
      const agentId = expense.agent_id;
      const agentName = expense.agent?.name || "Unassigned";

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          name: agentName,
          expenses: [],
          categoryTotals: {},
        });
      }

      const agentData = agentMap.get(agentId)!;
      agentData.expenses.push(expense);

      // Track category totals
      const category = expense.category;
      if (!agentData.categoryTotals[category]) {
        agentData.categoryTotals[category] = 0;
      }
      agentData.categoryTotals[category] += expense.amount;
    });

    // Convert to leaderboard entries
    const entries: AgentLeaderboardEntry[] = Array.from(agentMap.entries()).map(
      ([agentId, data]) => {
        const totalCost = data.expenses.reduce(
          (sum, exp) => sum + exp.amount,
          0
        );

        // Find top category
        let topCategory = "N/A";
        let topCategoryAmount = 0;

        const categoryEntries = Object.entries(data.categoryTotals);
        if (categoryEntries.length > 0) {
          const sorted = categoryEntries.sort((a, b) => b[1] - a[1]);
          topCategory = sorted[0][0];
          topCategoryAmount = sorted[0][1];
        }

        return {
          agentId,
          agentName: data.name,
          totalCost,
          topCategory,
          topCategoryAmount,
          expenseCount: data.expenses.length,
        };
      }
    );

    // Sort by total cost (descending)
    return entries.sort((a, b) => b.totalCost - a.totalCost);
  }, [expenses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="agent-expense-leaderboard-container">
        <LoadingState label="Loading leaderboard…" size="md" className="py-8" />
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="agent-expense-leaderboard-container">
        <div className="agent-expense-leaderboard-empty">
          No agent expenses found. Create expenses to see the leaderboard.
        </div>
      </div>
    );
  }

  return (
    <div className="agent-expense-leaderboard-container">
      <div className="agent-expense-leaderboard-header">
        <div className="agent-expense-leaderboard-header-content">
          <div className="agent-expense-leaderboard-title-section">
            <div className="agent-expense-leaderboard-icon">
              <Trophy className="agent-expense-leaderboard-icon-svg" />
            </div>
            <div>
              <h2 className="agent-expense-leaderboard-title">
                Agent Expense Leaderboard
              </h2>
              <p className="agent-expense-leaderboard-subtitle">
                Agents ranked by total expenses
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="agent-expense-leaderboard-content">
        {leaderboardData.map((entry, index) => {
          const rank = index + 1;
          const isTopThree = rank <= 3;
          const rankClass = isTopThree ? `rank-${rank}` : "";

          return (
            <div
              key={entry.agentId || "unassigned"}
              className={`agent-expense-leaderboard-item ${rankClass}`}
            >
              <div className="agent-expense-leaderboard-rank">
                {isTopThree ? (
                  <Trophy
                    className={`agent-expense-leaderboard-trophy rank-${rank}-trophy`}
                  />
                ) : (
                  <span className="agent-expense-leaderboard-rank-number">
                    {rank}
                  </span>
                )}
              </div>

              <div className="agent-expense-leaderboard-agent-info">
                <div className="agent-expense-leaderboard-agent-name">
                  {entry.agentName}
                </div>
                <div className="agent-expense-leaderboard-top-category">
                  <TrendingUp className="agent-expense-leaderboard-category-icon" />
                  <span>
                    Top: {entry.topCategory} (
                    {formatCurrency(entry.topCategoryAmount)})
                  </span>
                </div>
              </div>

              <div className="agent-expense-leaderboard-total">
                <div className="agent-expense-leaderboard-total-label">
                  Total Cost
                </div>
                <div className="agent-expense-leaderboard-total-amount">
                  {formatCurrency(entry.totalCost)}
                </div>
                <div className="agent-expense-leaderboard-expense-count">
                  {entry.expenseCount} expense{entry.expenseCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



