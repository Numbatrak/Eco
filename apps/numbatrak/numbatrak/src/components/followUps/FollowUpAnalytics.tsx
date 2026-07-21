import { useState, useEffect } from "react";
import { FollowUpAnalytics } from "../../types/followUp";
import { fetchFollowUpAnalytics } from "../../services/followUpAnalytics";
import { useOrganization } from "../../contexts/OrganizationContext";
import { formatWorkHours } from "../../utils/workHours";
import { LoadingState } from "../ui/LoadingState";
import { AlertCircle, BarChart3, CheckCircle2, Clock, Users } from "lucide-react";

interface FollowUpAnalyticsProps {
  dateFrom?: string;
  dateTo?: string;
  repId?: string;
}

export function FollowUpAnalytics({
  dateFrom,
  dateTo,
  repId,
}: FollowUpAnalyticsProps) {
  const { currentOrganization } = useOrganization();
  const [analytics, setAnalytics] = useState<FollowUpAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [dateFrom, dateTo, repId, currentOrganization?.id]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFollowUpAnalytics(
        currentOrganization?.id ?? null,
        dateFrom,
        dateTo,
        repId
      );
      setAnalytics(data);
    } catch (err) {
      console.error("Error loading analytics:", err);
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading analytics…" size="lg" />;
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

  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Follow-Ups</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {analytics.total_follow_ups}
              </p>
            </div>
            <div className="p-3 bg-primary/15 rounded-lg">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {analytics.overall_avg_response_time_minutes !== null
                  ? formatWorkHours(analytics.overall_avg_response_time_minutes)
                  : "N/A"}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">SLA Compliance</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {analytics.overall_sla_compliance_rate.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-primary/15 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Reps</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {analytics.rep_metrics.length}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{analytics.awaiting_count}</p>
            <p className="text-sm text-muted-foreground mt-1">Awaiting</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.followed_up_count}</p>
            <p className="text-sm text-muted-foreground mt-1">Followed up</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{analytics.resolved_count}</p>
            <p className="text-sm text-muted-foreground mt-1">Resolved</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{analytics.cancelled_count}</p>
            <p className="text-sm text-muted-foreground mt-1">Cancelled</p>
          </div>
        </div>
      </div>

      {/* Rep Performance Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Rep Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rep
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Resolution
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
              {analytics.rep_metrics.map((rep) => (
                <tr key={rep.rep_id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">{rep.rep_name}</div>
                      <div className="text-sm text-muted-foreground">{rep.rep_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {rep.total_follow_ups}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {rep.avg_response_time_minutes !== null
                      ? formatWorkHours(rep.avg_response_time_minutes)
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {rep.avg_resolution_time_minutes !== null
                      ? formatWorkHours(rep.avg_resolution_time_minutes)
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        rep.sla_compliance_rate >= 80
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : rep.sla_compliance_rate >= 60
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-destructive/15 text-destructive border border-destructive/30"
                      }`}
                    >
                      {rep.sla_compliance_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {rep.conversion_rate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}






