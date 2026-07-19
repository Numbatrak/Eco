import { describe, it, expect } from "vitest";
import { monthlyEquivalentCents } from "./mrr.js";
import { subscriptionVatPortionCents } from "../vat.js";
import { evaluateHealth, type HealthInputs } from "./health.js";

describe("monthlyEquivalentCents", () => {
  const plan = { priceMonthlyCents: 2999900, priceAnnuallyCents: 28799000 };

  it("returns the monthly price unchanged for monthly billing", () => {
    expect(monthlyEquivalentCents(plan, "monthly")).toBe(2999900);
  });

  it("divides the annual price by 12 for annual billing (LOCKED RULE)", () => {
    // Doc example: ₦120,000/year contributes ₦10,000 MRR, not ₦120,000.
    expect(monthlyEquivalentCents({ priceMonthlyCents: 0, priceAnnuallyCents: 12_000_000 }, "annual")).toBe(
      1_000_000,
    );
  });
});

describe("subscriptionVatPortionCents", () => {
  it("extracts the 7.5% portion from a VAT-inclusive total", () => {
    // ₦10,000 net displayed → ₦10,750 charged → ₦750 VAT.
    expect(subscriptionVatPortionCents(1_075_000)).toBe(75_000);
  });

  it("is zero for a zero charge", () => {
    expect(subscriptionVatPortionCents(0)).toBe(0);
  });
});

describe("evaluateHealth", () => {
  const base: HealthInputs = {
    churnRatePct: 3,
    trialToPaidPct: 30,
    ltvToCacRatio: null,
    paystackErroring: false,
    unresolvedFailedPayments: 0,
    hasAnyTenants: true,
  };

  it("reports the empty state before any tenants exist", () => {
    const report = evaluateHealth({ ...base, hasAnyTenants: false });
    expect(report.isEmpty).toBe(true);
    expect(report.overall).toBe("healthy");
    expect(report.dimensions).toHaveLength(0);
  });

  it("is healthy when churn <5% and trial-to-paid >25%", () => {
    const report = evaluateHealth(base);
    expect(report.overall).toBe("healthy");
    expect(report.alerts).toHaveLength(0);
  });

  it("warns when churn is 5–8%", () => {
    const churn = evaluateHealth({ ...base, churnRatePct: 6 }).dimensions.find((d) => d.key === "churn");
    expect(churn?.status).toBe("warning");
  });

  it("goes critical and fires an alert when churn >8%", () => {
    const report = evaluateHealth({ ...base, churnRatePct: 9 });
    expect(report.overall).toBe("critical");
    expect(report.alerts.some((a) => a.includes("Churn"))).toBe(true);
  });

  it("bands trial-to-paid: >25 healthy, 15–25 warning, <15 critical", () => {
    const dim = (pct: number) =>
      evaluateHealth({ ...base, trialToPaidPct: pct }).dimensions.find((d) => d.key === "trialToPaid")
        ?.status;
    expect(dim(30)).toBe("healthy");
    expect(dim(20)).toBe("warning");
    expect(dim(10)).toBe("critical");
  });

  it("treats an unavailable LTV:CAC as unknown, not a colour", () => {
    const dim = evaluateHealth(base).dimensions.find((d) => d.key === "ltvToCac");
    expect(dim?.status).toBe("unknown");
  });

  it("goes critical when Paystack is erroring", () => {
    const report = evaluateHealth({ ...base, paystackErroring: true });
    expect(report.overall).toBe("critical");
    expect(report.alerts.some((a) => a.toLowerCase().includes("paystack"))).toBe(true);
  });

  it("warns when there are unresolved failed payments", () => {
    const dim = evaluateHealth({ ...base, unresolvedFailedPayments: 2 }).dimensions.find(
      (d) => d.key === "failedPayments",
    );
    expect(dim?.status).toBe("warning");
  });
});
