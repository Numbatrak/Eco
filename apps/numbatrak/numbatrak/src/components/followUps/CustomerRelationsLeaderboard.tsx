import { useState, useEffect } from "react";
import { CustomerRelationsLeaderboardEntry } from "../../services/customerRelationsLeaderboard";
import { fetchCustomerRelationsLeaderboard } from "../../services/customerRelationsLeaderboard";
import { useOrganization } from "../../contexts/OrganizationContext";
import { formatWorkHours } from "../../utils/workHours";
import { Trophy, Medal, Award, Users, Clock, AlertCircle } from "lucide-react";
import { LottieLoader } from "../ui/LottieLoader";

interface CustomerRelationsLeaderboardProps {
  dateFrom?: string;
  dateTo?: string;
}

function slaBadgeClass(rate: number): string {
  if (rate >= 80) {
    return "bg-primary/15 text-primary border border-primary/30";
  }
  if (rate >= 60) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30";
  }
  return "bg-destructive/15 text-destructive border border-destructive/30";
}

export function CustomerRelationsLeaderboard({
  dateFrom,
  dateTo,
}: CustomerRelationsLeaderboardProps) {
  const { currentOrganization } = useOrganization();
  const [leaderboard, setLeaderboard] = useState<CustomerRelationsLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"rank" | "response_time" | "customers" | "sla">("rank");

  useEffect(() => {
    loadLeaderboard();
  }, [dateFrom, dateTo, currentOrganization?.id]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCustomerRelationsLeaderboard(
        currentOrganization?.id ?? null,
        dateFrom,
        dateTo
      );
      setLeaderboard(data);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="w-5 h-5 text-amber-500" />;
    }
    if (rank === 2) {
      return <Medal className="w-5 h-5 text-muted-foreground" />;
    }
    if (rank === 3) {
      return <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    }
    return <span className="font-bold text-muted-foreground">#{rank}</span>;
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case "response_time":
        if (a.avg_response_time_minutes === null && b.avg_response_time_minutes === null) return 0;
        if (a.avg_response_time_minutes === null) return 1;
        if (b.avg_response_time_minutes === null) return -1;
        return a.avg_response_time_minutes - b.avg_response_time_minutes;
      case "customers":
        return (b.customers_responded_to || 0) - (a.customers_responded_to || 0);
      case "sla":
        return b.sla_compliance_rate - a.sla_compliance_rate;
      case "rank":
      default:
        return a.rank - b.rank;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LottieLoader size={100} message="Loading leaderboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center text-destructive">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Customer Relations Leaderboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Performance rankings based on response time, SLA compliance, and customer engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="rank">Rank</option>
            <option value="response_time">Response Time</option>
            <option value="customers">Customers Responded</option>
            <option value="sla">SLA Compliance</option>
          </select>
        </div>
      </div>

      {sortedLeaderboard.length >= 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {sortedLeaderboard[1] && (
            <div className="rounded-xl p-6 text-center border-2 border-border bg-muted/60">
              <div className="flex justify-center mb-2">
                <Medal className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">2nd</div>
              <div className="text-lg font-semibold text-foreground">
                {sortedLeaderboard[1].rep_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {sortedLeaderboard[1].rep_email}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {sortedLeaderboard[1].avg_response_time_minutes !== null
                  ? formatWorkHours(sortedLeaderboard[1].avg_response_time_minutes)
                  : "N/A"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {sortedLeaderboard[1].customers_responded_to || 0} customers
              </div>
            </div>
          )}

          {sortedLeaderboard[0] && (
            <div className="rounded-xl p-6 text-center border-2 border-primary bg-primary/10 shadow-lg sm:scale-105">
              <div className="flex justify-center mb-2">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <div className="text-3xl font-bold text-primary mb-1">1st</div>
              <div className="text-xl font-bold text-foreground">
                {sortedLeaderboard[0].rep_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {sortedLeaderboard[0].rep_email}
              </div>
              <div className="text-base font-semibold text-foreground mt-2">
                {sortedLeaderboard[0].avg_response_time_minutes !== null
                  ? formatWorkHours(sortedLeaderboard[0].avg_response_time_minutes)
                  : "N/A"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {sortedLeaderboard[0].customers_responded_to || 0} customers
              </div>
              <div className="text-xs text-primary font-semibold mt-2">
                {sortedLeaderboard[0].sla_compliance_rate.toFixed(1)}% SLA
              </div>
            </div>
          )}

          {sortedLeaderboard[2] && (
            <div className="rounded-xl p-6 text-center border-2 border-amber-500/40 bg-amber-500/10">
              <div className="flex justify-center mb-2">
                <Award className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mb-1">
                3rd
              </div>
              <div className="text-lg font-semibold text-foreground">
                {sortedLeaderboard[2].rep_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {sortedLeaderboard[2].rep_email}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {sortedLeaderboard[2].avg_response_time_minutes !== null
                  ? formatWorkHours(sortedLeaderboard[2].avg_response_time_minutes)
                  : "N/A"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {sortedLeaderboard[2].customers_responded_to || 0} customers
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">Full Leaderboard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer Relations Rep
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customers Responded To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Follow-Ups
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  SLA Compliance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Conversion Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {sortedLeaderboard.map((entry) => (
                <tr
                  key={entry.rep_id}
                  className={`hover:bg-muted/50 transition-colors ${
                    entry.rank <= 3 ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">{getRankIcon(entry.rank)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">{entry.rep_name}</div>
                      <div className="text-sm text-muted-foreground">{entry.rep_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {entry.avg_response_time_minutes !== null
                          ? formatWorkHours(entry.avg_response_time_minutes)
                          : "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {entry.customers_responded_to || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {entry.total_follow_ups}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${slaBadgeClass(entry.sla_compliance_rate)}`}
                    >
                      {entry.sla_compliance_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {entry.conversion_rate.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {sortedLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No Customer Relations users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
