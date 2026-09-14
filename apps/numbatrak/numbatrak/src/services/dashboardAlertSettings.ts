import { apiRequest } from "../lib/apiClient";
import {
  DEFAULT_DASHBOARD_ALERT_THRESHOLDS,
  type DashboardAlertThresholds,
} from "../constants/dashboardAlerts";

// Mirrors apps/api's @platform/shared-types
// numbatrakDashboardAlertThresholdsSchema shape locally rather than
// importing it - this app doesn't depend on @platform/shared-types (see
// lib/authApi.ts for the same convention).
type DashboardAlertThresholdsRow = DashboardAlertThresholds & {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
};

function toThresholds(row: DashboardAlertThresholdsRow): DashboardAlertThresholds {
  return {
    deliveryRateGreen: row.deliveryRateGreen,
    deliveryRateAmber: row.deliveryRateAmber,
    deliveryRateAlert: row.deliveryRateAlert,
    roasGreen: row.roasGreen,
    roasAmber: row.roasAmber,
    profitPerOrderGreen: row.profitPerOrderGreen,
    profitPerOrderAmber: row.profitPerOrderAmber,
    businessRoiGreen: row.businessRoiGreen,
    businessRoiAmber: row.businessRoiAmber,
    realCpaAovGreen: row.realCpaAovGreen,
    realCpaAovAmber: row.realCpaAovAmber,
    minUndeliveredForAlert: row.minUndeliveredForAlert,
    minWouldBeSalesForAlert: row.minWouldBeSalesForAlert,
    cpaWeekOnWeekIncreasePct: row.cpaWeekOnWeekIncreasePct,
  };
}

/** DB-backed as of this port - shared across every device/user in the org
 * rather than the one browser that last saved it. */
export async function loadDashboardAlertThresholds(
  organizationId: string | null | undefined
): Promise<DashboardAlertThresholds> {
  if (!organizationId) return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS };
  try {
    const row = await apiRequest<DashboardAlertThresholdsRow>(
      "/org/numbatrak/dashboard/alert-thresholds"
    );
    return toThresholds(row);
  } catch {
    return { ...DEFAULT_DASHBOARD_ALERT_THRESHOLDS };
  }
}

export async function saveDashboardAlertThresholds(
  thresholds: DashboardAlertThresholds
): Promise<DashboardAlertThresholds> {
  const row = await apiRequest<DashboardAlertThresholdsRow>(
    "/org/numbatrak/dashboard/alert-thresholds",
    { method: "PATCH", body: thresholds }
  );
  return toThresholds(row);
}

export async function resetDashboardAlertThresholds(): Promise<DashboardAlertThresholds> {
  return saveDashboardAlertThresholds(DEFAULT_DASHBOARD_ALERT_THRESHOLDS);
}
