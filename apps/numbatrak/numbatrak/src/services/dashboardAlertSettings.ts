import {
  DEFAULT_DASHBOARD_ALERT_THRESHOLDS,
  type DashboardAlertThresholds,
} from "../constants/dashboardAlerts";

const STORAGE_PREFIX = "numbatrak:dashboard-alert-thresholds:";

function storageKey(organizationId: string): string {
  return `${STORAGE_PREFIX}${organizationId}`;
}

export function loadDashboardAlertThresholds(
  organizationId: string | null | undefined
): DashboardAlertThresholds {
  if (!organizationId || typeof localStorage === "undefined") {
    return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS };
  }
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS };
    const parsed = JSON.parse(raw) as Partial<DashboardAlertThresholds>;
    return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS, ...parsed };
  } catch {
    return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS };
  }
}

export function saveDashboardAlertThresholds(
  organizationId: string,
  thresholds: DashboardAlertThresholds
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(organizationId), JSON.stringify(thresholds));
}

export function resetDashboardAlertThresholds(organizationId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(storageKey(organizationId));
}
