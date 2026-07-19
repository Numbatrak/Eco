// Health-state evaluator for the Super Admin Overview.
//
// Thresholds are the LOCKED RULES from SuperAdmin.docx, Tab 1 (Overview),
// LAYER 3 States + LAYER 4 Rules:
//   • churn:         <5% healthy · 5–8% warning · >8% critical (fires alert)
//   • trial-to-paid: >25% healthy · 15–25% warning · <15% critical
//   • LTV:CAC:       >5:1 healthy · 2:1–5:1 warning · <2:1 critical
//   • integration errors / unresolved failed payments → critical
//
// A metric whose inputs aren't available yet (e.g. LTV:CAC before ad-spend
// data exists) is reported as "unknown" and excluded from the overall roll-up
// rather than being forced to a colour.

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface HealthDimension {
  key: string;
  status: HealthStatus;
  value: number | null;
  message: string;
}

export interface HealthReport {
  overall: HealthStatus;
  isEmpty: boolean;
  dimensions: HealthDimension[];
  // Human-readable reasons for any critical dimension — these are what the
  // founder-alert sink (G5) consumes. Empty when nothing is critical.
  alerts: string[];
}

export interface HealthInputs {
  churnRatePct: number | null;
  trialToPaidPct: number | null;
  ltvToCacRatio: number | null;
  paystackErroring: boolean;
  unresolvedFailedPayments: number;
  hasAnyTenants: boolean;
}

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = {
    unknown: -1,
    healthy: 0,
    warning: 1,
    critical: 2,
  };
  return rank[b] > rank[a] ? b : a;
}

export function evaluateHealth(inputs: HealthInputs): HealthReport {
  if (!inputs.hasAnyTenants) {
    return {
      overall: "healthy",
      isEmpty: true,
      dimensions: [],
      alerts: [],
    };
  }

  const dimensions: HealthDimension[] = [];

  // Churn
  if (inputs.churnRatePct === null) {
    dimensions.push({
      key: "churn",
      status: "unknown",
      value: null,
      message: "Churn needs at least one prior snapshot to compute.",
    });
  } else {
    const churn = inputs.churnRatePct;
    const status: HealthStatus = churn > 8 ? "critical" : churn >= 5 ? "warning" : "healthy";
    dimensions.push({
      key: "churn",
      status,
      value: churn,
      message: `Churn ${churn.toFixed(1)}% (healthy <5%, critical >8%).`,
    });
  }

  // Trial-to-paid
  if (inputs.trialToPaidPct === null) {
    dimensions.push({
      key: "trialToPaid",
      status: "unknown",
      value: null,
      message: "No trial starts in range yet.",
    });
  } else {
    const conv = inputs.trialToPaidPct;
    const status: HealthStatus = conv < 15 ? "critical" : conv <= 25 ? "warning" : "healthy";
    dimensions.push({
      key: "trialToPaid",
      status,
      value: conv,
      message: `Trial-to-paid ${conv.toFixed(1)}% (healthy >25%, critical <15%).`,
    });
  }

  // LTV:CAC — unknown until ad-spend data exists (Phase B2 / Tab 7).
  if (inputs.ltvToCacRatio === null) {
    dimensions.push({
      key: "ltvToCac",
      status: "unknown",
      value: null,
      message: "LTV:CAC awaits ad-spend data (Business Numbers tab).",
    });
  } else {
    const ratio = inputs.ltvToCacRatio;
    const status: HealthStatus = ratio < 2 ? "critical" : ratio <= 5 ? "warning" : "healthy";
    dimensions.push({
      key: "ltvToCac",
      status,
      value: ratio,
      message: `LTV:CAC ${ratio.toFixed(1)}:1 (healthy >5:1, critical <2:1).`,
    });
  }

  // Integration health
  dimensions.push({
    key: "paystack",
    status: inputs.paystackErroring ? "critical" : "healthy",
    value: null,
    message: inputs.paystackErroring
      ? "Platform Paystack integration is erroring."
      : "Platform Paystack healthy.",
  });

  // Failed payments / dunning queue
  const failed = inputs.unresolvedFailedPayments;
  const failedStatus: HealthStatus = failed > 0 ? "warning" : "healthy";
  dimensions.push({
    key: "failedPayments",
    status: failedStatus,
    value: failed,
    message:
      failed > 0
        ? `${failed} unresolved failed payment(s) in the dunning pipeline.`
        : "No unresolved failed payments.",
  });

  const overall = dimensions.reduce<HealthStatus>((acc, d) => worst(acc, d.status), "healthy");
  const alerts = dimensions.filter((d) => d.status === "critical").map((d) => d.message);

  return { overall, isEmpty: false, dimensions, alerts };
}
