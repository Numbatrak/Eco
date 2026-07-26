import type { HealthBand } from "../utils/dashboardHealth";
import type {
  BusinessPerformanceMetrics,
  LossMetrics,
} from "./dashboardMetrics";
import {
  type DashboardAlertThresholds,
  type DashboardWatcherId,
  WATCHER_LABELS,
  DEFAULT_DASHBOARD_ALERT_THRESHOLDS,
} from "../constants/dashboardAlerts";
import {
  deliveryRateBandWithThresholds,
  roasBandWithThresholds,
  profitPerOrderBandWithThresholds,
  businessRoiBandWithThresholds,
  realCpaBandWithThresholds,
} from "../utils/dashboardHealth";

export type DashboardAlertSeverity = "amber" | "red";

export type DashboardAlert = {
  id: string;
  watcher: DashboardWatcherId;
  severity: DashboardAlertSeverity;
  title: string;
  message: string;
  href?: string;
};

export function computeDashboardAlerts(input: {
  metrics: BusinessPerformanceMetrics;
  loss?: LossMetrics | null;
  thresholds?: DashboardAlertThresholds;
  priorMetrics?: BusinessPerformanceMetrics | null;
  hasAdSpend?: boolean;
  includeBusinessRoi?: boolean;
}): DashboardAlert[] {
  const {
    metrics: m,
    loss,
    thresholds = DEFAULT_DASHBOARD_ALERT_THRESHOLDS,
    priorMetrics,
    hasAdSpend = m.adSpend > 0,
    includeBusinessRoi = true,
  } = input;

  const alerts: DashboardAlert[] = [];

  const deliveryBand = deliveryRateBandWithThresholds(m.deliveryRate, thresholds);
  if (m.totalOrdersGenerated > 0 && m.deliveryRate < thresholds.deliveryRateAlert) {
    alerts.push({
      id: "delivery_rate",
      watcher: "delivery_rate",
      severity: deliveryBand === "red" ? "red" : "amber",
      title: WATCHER_LABELS.delivery_rate,
      message: `Delivery rate is ${m.deliveryRate.toFixed(1)}% (alert below ${thresholds.deliveryRateAlert}%).`,
      href: "/",
    });
  }

  if (hasAdSpend) {
    const roasBand = roasBandWithThresholds(m.roas, true, thresholds);
    if (roasBand === "red" || roasBand === "amber") {
      alerts.push({
        id: "roas",
        watcher: "roas",
        severity: roasBand === "red" ? "red" : "amber",
        title: WATCHER_LABELS.roas,
        message: `ROAS is ${m.roas.toFixed(2)}× (target green ≥ ${thresholds.roasGreen}×).`,
        href: "/",
      });
    }

    const cpaBand = realCpaBandWithThresholds(
      m.realCpa,
      m.averageOrderValue,
      true,
      thresholds
    );
    if (cpaBand === "red" || cpaBand === "amber") {
      alerts.push({
        id: "real_cpa",
        watcher: "real_cpa",
        severity: cpaBand === "red" ? "red" : "amber",
        title: WATCHER_LABELS.real_cpa,
        message: `Real CPA is ${formatNgn(m.realCpa)} vs AOV ${formatNgn(m.averageOrderValue)}.`,
        href: "/",
      });
    }

    if (
      priorMetrics &&
      priorMetrics.realCpa > 0 &&
      m.realCpa > priorMetrics.realCpa
    ) {
      const increasePct =
        ((m.realCpa - priorMetrics.realCpa) / priorMetrics.realCpa) * 100;
      if (increasePct >= thresholds.cpaWeekOnWeekIncreasePct) {
        alerts.push({
          id: "real_cpa_wow",
          watcher: "real_cpa",
          severity: "red",
          title: "Real CPA rising",
          message: `Real CPA up ${increasePct.toFixed(0)}% vs prior period (limit ${thresholds.cpaWeekOnWeekIncreasePct}%).`,
          href: "/",
        });
      }
    }
  }

  const profitBand = profitPerOrderBandWithThresholds(m.profitPerOrder, thresholds);
  if (m.totalOrdersDelivered > 0 && (profitBand === "red" || profitBand === "amber")) {
    alerts.push({
      id: "profit_per_order",
      watcher: "profit_per_order",
      severity: profitBand === "red" ? "red" : "amber",
      title: WATCHER_LABELS.profit_per_order,
      message: `Profit per delivered order is ${formatNgn(m.profitPerOrder)}.`,
      href: "/",
    });
  }

  if (includeBusinessRoi && m.totalInvestment > 0) {
    const roiBand = businessRoiBandWithThresholds(
      m.businessRoi,
      true,
      thresholds
    );
    if (roiBand === "red" || roiBand === "amber") {
      alerts.push({
        id: "business_roi",
        watcher: "business_roi",
        severity: roiBand === "red" ? "red" : "amber",
        title: WATCHER_LABELS.business_roi,
        message: `Business ROI is ${m.businessRoi.toFixed(2)}× after all expenses.`,
        href: "/",
      });
    }
  }

  if (loss) {
    const lossTriggered =
      loss.undeliveredCount >= thresholds.minUndeliveredForAlert ||
      loss.wouldBeSales >= thresholds.minWouldBeSalesForAlert;
    if (lossTriggered && loss.undeliveredCount > 0) {
      alerts.push({
        id: "undelivered_loss",
        watcher: "undelivered_loss",
        severity: "red",
        title: WATCHER_LABELS.undelivered_loss,
        message: `${loss.undeliveredCount} undelivered orders — ${formatNgn(loss.wouldBeSales)} would-be sales.`,
        href: "/",
      });
    }
  }

  return dedupeAlerts(alerts);
}

function dedupeAlerts(alerts: DashboardAlert[]): DashboardAlert[] {
  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function formatNgn(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Map health band to whether it should surface as an alert (amber+ for band-driven UI). */
export function bandTriggersAlert(band: HealthBand | null): boolean {
  return band === "amber" || band === "red";
}
