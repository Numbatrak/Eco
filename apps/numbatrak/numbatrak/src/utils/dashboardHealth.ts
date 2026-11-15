import type { HealthBand } from "./dashboardHealth";
import type { DashboardAlertThresholds } from "../constants/dashboardAlerts";
import { DEFAULT_DASHBOARD_ALERT_THRESHOLDS } from "../constants/dashboardAlerts";

export type { HealthBand };

// Text colours, not fill colours. #10b981/amber-500/red-500 are only ~2.2-3.8:1
// against a white card, so they fail WCAG AA wherever they're used as type;
// these darker variants clear 4.5:1 in light mode and the dark theme keeps the
// bright values. Fills (bars, dots, borders) still use the originals.
const HEALTH_TEXT: Record<HealthBand, string> = {
  green: "text-primary-text",
  amber: "text-warn-text",
  red: "text-danger-text",
};

const HEALTH_BORDER: Record<HealthBand, string> = {
  green: "border-emerald-500/30",
  amber: "border-amber-500/30",
  red: "border-red-500/30",
};

export function healthTextClass(band: HealthBand): string {
  return HEALTH_TEXT[band];
}

export function healthBorderClass(band: HealthBand): string {
  return HEALTH_BORDER[band];
}

export function deliveryRateBandWithThresholds(
  rate: number,
  t: DashboardAlertThresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS
): HealthBand {
  if (rate >= t.deliveryRateGreen) return "green";
  if (rate >= t.deliveryRateAmber) return "amber";
  return "red";
}

/** @deprecated Use deliveryRateBandWithThresholds */
export function deliveryRateBand(rate: number): HealthBand {
  return deliveryRateBandWithThresholds(rate);
}

export function roasBandWithThresholds(
  roas: number,
  hasAdSpend: boolean,
  t: DashboardAlertThresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS
): HealthBand | null {
  if (!hasAdSpend) return null;
  if (roas >= t.roasGreen) return "green";
  if (roas >= t.roasAmber) return "amber";
  return "red";
}

export function roasBand(roas: number, hasAdSpend: boolean): HealthBand | null {
  return roasBandWithThresholds(roas, hasAdSpend);
}

export function profitPerOrderBandWithThresholds(
  profit: number,
  t: DashboardAlertThresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS
): HealthBand {
  if (profit > t.profitPerOrderGreen) return "green";
  if (profit >= t.profitPerOrderAmber) return "amber";
  return "red";
}

export function profitPerOrderBand(profit: number): HealthBand {
  return profitPerOrderBandWithThresholds(profit);
}

export function businessRoiBandWithThresholds(
  roi: number,
  hasInvestment: boolean,
  t: DashboardAlertThresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS
): HealthBand | null {
  if (!hasInvestment) return null;
  if (roi >= t.businessRoiGreen) return "green";
  if (roi >= t.businessRoiAmber) return "amber";
  return "red";
}

export function businessRoiBand(
  roi: number,
  hasInvestment: boolean
): HealthBand | null {
  return businessRoiBandWithThresholds(roi, hasInvestment);
}

export function realCpaBandWithThresholds(
  realCpa: number,
  aov: number,
  hasAdSpend: boolean,
  t: DashboardAlertThresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS
): HealthBand | null {
  if (!hasAdSpend || aov <= 0) return null;
  const ratio = realCpa / aov;
  if (ratio <= t.realCpaAovGreen) return "green";
  if (ratio <= t.realCpaAovAmber) return "amber";
  return "red";
}

export function realCpaBand(
  realCpa: number,
  aov: number,
  hasAdSpend: boolean
): HealthBand | null {
  return realCpaBandWithThresholds(realCpa, aov, hasAdSpend);
}
