import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bell, X, AlertTriangle } from "lucide-react";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchBusinessPerformanceMetrics,
  fetchLossMetrics,
} from "../../services/dashboardMetrics";
import { computeDashboardAlerts, type DashboardAlert } from "../../services/dashboardAlerts";
import { loadDashboardAlertThresholds } from "../../services/dashboardAlertSettings";
import { resolveDateRange, type DateFilter } from "../../utils/dateRange";
import { csrScopeFilter } from "../../utils/specRoles";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import { useDashboardAlertsContext } from "../../contexts/DashboardAlertsContext";
import type { DashboardMetricsScope } from "../../services/dashboardMetrics";

const DISMISSED_PREFIX = "numbatrak:dismissed-dashboard-alerts:";

function dismissedKey(orgId: string): string {
  return `${DISMISSED_PREFIX}${orgId}`;
}

function loadDismissed(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(orgId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(orgId: string, ids: Set<string>): void {
  localStorage.setItem(dismissedKey(orgId), JSON.stringify([...ids]));
}

interface DashboardNotificationBellProps {}

export function DashboardNotificationBell(_props: DashboardNotificationBellProps) {
  const { dateFilter, scope, viewMode } = useDashboardAlertsContext();
  const { currentOrganization } = useOrganization();
  const { hasAnyRole, userRole } = usePermissions();
  const { user } = useSupabaseAuth();
  const canView = hasAnyRole(["Manager", "Admin", "Owner"]);

  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const effectiveScope = useCallback((): DashboardMetricsScope => {
    const scopedCsr = csrScopeFilter(userRole, user?.id);
    return { ...scope, csrId: scopedCsr ?? scope.csrId ?? null };
  }, [scope, userRole, user?.id]);

  const refreshAlerts = useCallback(async () => {
    if (!currentOrganization || !canView) {
      setAlerts([]);
      return;
    }
    try {
      setLoading(true);
      const thresholds = loadDashboardAlertThresholds(currentOrganization.id);
      const { startDate, endDate } = resolveDateRange(dateFilter);
      const metricsScope = effectiveScope();

      const [metrics, loss, priorMetrics] = await Promise.all([
        fetchBusinessPerformanceMetrics(
          currentOrganization.id,
          startDate,
          endDate,
          metricsScope
        ),
        fetchLossMetrics(
          currentOrganization.id,
          startDate,
          endDate,
          metricsScope
        ),
        fetchPriorPeriodMetrics(
          currentOrganization.id,
          dateFilter,
          metricsScope
        ),
      ]);

      const computed = computeDashboardAlerts({
        metrics,
        loss,
        thresholds,
        priorMetrics,
        includeBusinessRoi: viewMode === "business",
      });
      setAlerts(computed);
    } catch (e) {
      console.error("DashboardNotificationBell:", e);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, canView, dateFilter, effectiveScope, viewMode]);

  useEffect(() => {
    if (!currentOrganization) return;
    setDismissed(loadDismissed(currentOrganization.id));
  }, [currentOrganization?.id]);

  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(refreshAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  const dismiss = (id: string) => {
    if (!currentOrganization) return;
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(currentOrganization.id, next);
  };

  const clearAll = () => {
    if (!currentOrganization) return;
    const next = new Set(dismissed);
    visibleAlerts.forEach((a) => next.add(a.id));
    setDismissed(next);
    saveDismissed(currentOrganization.id, next);
  };

  if (!canView) return null;

  return (
    <div className="relative" data-dashboard-bell>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refreshAlerts();
        }}
        className="relative p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
        title="Dashboard alerts"
        aria-label="Dashboard alerts"
      >
        <Bell size={20} />
        {visibleAlerts.length > 0 && (
          <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {visibleAlerts.length > 9 ? "9+" : visibleAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(92vw,360px)] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-[1000] overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Dashboard alerts</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Checking metrics…</p>
          ) : visibleAlerts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No red flags for the current filters.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {visibleAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`p-3 border-l-4 ${
                    alert.severity === "red"
                      ? "border-l-red-500 bg-red-500/5"
                      : "border-l-amber-500 bg-amber-500/5"
                  }`}
                >
                  <div className="flex gap-2">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        alert.severity === "red"
                          ? "text-red-500"
                          : "text-amber-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alert.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(alert.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="p-2 border-t border-border flex items-center justify-between gap-2">
            {visibleAlerts.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss all
              </button>
            )}
            <Link
              to="/organization-settings"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline ml-auto"
            >
              Alert thresholds
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Prior period of equal length for week-on-week CPA comparison. */
async function fetchPriorPeriodMetrics(
  organizationId: string,
  dateFilter: DateFilter,
  scope: DashboardMetricsScope
) {
  const { startDate, endDate } = resolveDateRange(dateFilter);
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return null;

  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - durationMs);

  return fetchBusinessPerformanceMetrics(
    organizationId,
    priorStart.toISOString(),
    priorEnd.toISOString(),
    scope
  );
}
