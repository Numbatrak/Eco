/** Six dashboard watchers — same thresholds drive colour tonation and red-flag alerts. */
export const DASHBOARD_WATCHERS = [
  "delivery_rate",
  "roas",
  "real_cpa",
  "profit_per_order",
  "business_roi",
  "undelivered_loss",
] as const;

export type DashboardWatcherId = (typeof DASHBOARD_WATCHERS)[number];

export type DashboardAlertThresholds = {
  /** Green when delivery rate is at or above this value */
  deliveryRateGreen: number;
  /** Amber floor — below this is red */
  deliveryRateAmber: number;
  /** Fire alert when delivery rate drops below this (spec default 65%) */
  deliveryRateAlert: number;

  roasGreen: number;
  roasAmber: number;

  profitPerOrderGreen: number;
  profitPerOrderAmber: number;

  businessRoiGreen: number;
  businessRoiAmber: number;

  /** Real CPA ÷ AOV — green when at or below */
  realCpaAovGreen: number;
  realCpaAovAmber: number;

  /** Undelivered-loss watcher */
  minUndeliveredForAlert: number;
  minWouldBeSalesForAlert: number;

  /** Real CPA week-on-week increase % that triggers alert (spec default 15%) */
  cpaWeekOnWeekIncreasePct: number;
};

export const DEFAULT_DASHBOARD_ALERT_THRESHOLDS: DashboardAlertThresholds = {
  deliveryRateGreen: 70,
  deliveryRateAmber: 50,
  deliveryRateAlert: 65,
  roasGreen: 3,
  roasAmber: 1.5,
  profitPerOrderGreen: 500,
  profitPerOrderAmber: 0,
  businessRoiGreen: 0.2,
  businessRoiAmber: 0,
  realCpaAovGreen: 0.35,
  realCpaAovAmber: 0.55,
  minUndeliveredForAlert: 3,
  minWouldBeSalesForAlert: 25_000,
  cpaWeekOnWeekIncreasePct: 15,
};

export const WATCHER_LABELS: Record<DashboardWatcherId, string> = {
  delivery_rate: "Delivery rate",
  roas: "ROAS",
  real_cpa: "Real CPA",
  profit_per_order: "Profit per order",
  business_roi: "Business ROI",
  undelivered_loss: "Undelivered loss",
};
