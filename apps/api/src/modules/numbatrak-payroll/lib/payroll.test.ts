import { describe, it, expect } from "vitest";
import { calculatePay } from "./payroll.js";

type PayStructureRow = Parameters<typeof calculatePay>[0];
type OrderData = Parameters<typeof calculatePay>[1];

/** Every column defaulted "off" - each test only overrides what it's exercising. */
function basePs(overrides: Partial<PayStructureRow> = {}): PayStructureRow {
  return {
    id: "ps-1",
    organizationId: "org-1",
    scopeType: "role",
    role: "CRS",
    staffId: null,
    baseSalaryEnabled: false,
    baseSalaryAmount: "0",
    commissionEnabled: false,
    commissionBasis: null,
    commissionRate: "0",
    commissionGateEnabled: false,
    commissionGateThresholdPercent: "0",
    upsellBonusEnabled: false,
    upsellBonusAmount: "0",
    sotmBonusEnabled: false,
    sotmBonusAmount: "0",
    managerBonusEnabled: false,
    managerBonusAmount: "0",
    managerGateEnabled: false,
    managerGateTeamRatioPercent: "50",
    managerGateKpiThresholdPercent: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function orderData(overrides: Partial<OrderData> = {}): OrderData {
  return {
    totalOrders: 0,
    totalRevenue: 0,
    deliveredCount: 0,
    deliveryRate: 0,
    upsellCount: 0,
    ...overrides,
  };
}

describe("calculatePay: base salary", () => {
  it("pays the flat amount when enabled", () => {
    const result = calculatePay(basePs({ baseSalaryEnabled: true, baseSalaryAmount: "150000" }), orderData(), []);
    expect(result.calculatedBaseSalary).toBe("150000");
  });

  it("pays nothing when disabled, regardless of the configured amount", () => {
    const result = calculatePay(basePs({ baseSalaryEnabled: false, baseSalaryAmount: "150000" }), orderData(), []);
    expect(result.calculatedBaseSalary).toBe("0");
  });
});

describe("calculatePay: commission", () => {
  it("flat_per_order: rate x total orders, ungated", () => {
    const ps = basePs({ commissionEnabled: true, commissionBasis: "flat_per_order", commissionRate: "500" });
    const result = calculatePay(ps, orderData({ totalOrders: 12 }), []);
    expect(result.calculatedCommission).toBe("6000");
    expect(result.commissionGateMissed).toBe(false);
  });

  it("percentage_of_sale: rate% of total revenue", () => {
    const ps = basePs({ commissionEnabled: true, commissionBasis: "percentage_of_sale", commissionRate: "10" });
    const result = calculatePay(ps, orderData({ totalRevenue: 200000 }), []);
    expect(result.calculatedCommission).toBe("20000");
  });

  it("delivery-rate gate zeroes the WHOLE month's commission when missed, not a partial reduction", () => {
    const ps = basePs({
      commissionEnabled: true,
      commissionBasis: "flat_per_order",
      commissionRate: "500",
      commissionGateEnabled: true,
      commissionGateThresholdPercent: "80",
    });
    const result = calculatePay(ps, orderData({ totalOrders: 20, deliveryRate: 79.99 }), []);
    expect(result.commissionGateMissed).toBe(true);
    expect(result.calculatedCommission).toBe("0");
  });

  it("delivery-rate gate pays in full when cleared", () => {
    const ps = basePs({
      commissionEnabled: true,
      commissionBasis: "flat_per_order",
      commissionRate: "500",
      commissionGateEnabled: true,
      commissionGateThresholdPercent: "80",
    });
    const result = calculatePay(ps, orderData({ totalOrders: 20, deliveryRate: 80 }), []);
    expect(result.commissionGateMissed).toBe(false);
    expect(result.calculatedCommission).toBe("10000");
  });

  it("pays nothing when commission is disabled", () => {
    const ps = basePs({ commissionEnabled: false, commissionBasis: "flat_per_order", commissionRate: "500" });
    const result = calculatePay(ps, orderData({ totalOrders: 20 }), []);
    expect(result.calculatedCommission).toBe("0");
    expect(result.commissionGateMissed).toBe(false);
  });

  it("media-buyer input (deliveryRate fixed at 100) always clears a delivery-rate gate", () => {
    // getMediaBuyerOrderData() always returns deliveryRate: 100 - documents
    // that a commission gate enabled on a Media pay structure can never
    // zero out a buyer's commission, matching the "no delivery-rate concept
    // for media buyers" design intent.
    const ps = basePs({
      commissionEnabled: true,
      commissionBasis: "flat_per_order",
      commissionRate: "200",
      commissionGateEnabled: true,
      commissionGateThresholdPercent: "99",
    });
    const mediaOrderData = orderData({ totalOrders: 7, deliveredCount: 7, deliveryRate: 100 });
    const result = calculatePay(ps, mediaOrderData, []);
    expect(result.commissionGateMissed).toBe(false);
    expect(result.calculatedCommission).toBe("1400");
  });
});

describe("calculatePay: upsell bonus", () => {
  it("count x rate, never gated", () => {
    const ps = basePs({ upsellBonusEnabled: true, upsellBonusAmount: "500" });
    const result = calculatePay(ps, orderData({ upsellCount: 4 }), []);
    expect(result.calculatedUpsellBonus).toBe("2000");
  });

  it("pays nothing when disabled", () => {
    const ps = basePs({ upsellBonusEnabled: false, upsellBonusAmount: "500" });
    const result = calculatePay(ps, orderData({ upsellCount: 4 }), []);
    expect(result.calculatedUpsellBonus).toBe("0");
  });
});

describe("calculatePay: manager bonus + team-ratio gate", () => {
  it("pays in full when no gate is configured", () => {
    const ps = basePs({ managerBonusEnabled: true, managerBonusAmount: "10000", managerGateEnabled: false });
    const result = calculatePay(ps, orderData(), []);
    expect(result.managerGateMissed).toBeNull();
    expect(result.calculatedManagerBonus).toBe("10000");
  });

  it("gate passes when the team's hit-rate meets the required ratio", () => {
    const ps = basePs({
      managerBonusEnabled: true,
      managerBonusAmount: "10000",
      managerGateEnabled: true,
      managerGateKpiThresholdPercent: "50",
      managerGateTeamRatioPercent: "100",
    });
    // 2 of 2 team members individually clear the 50% KPI threshold.
    const result = calculatePay(ps, orderData(), [60, 75]);
    expect(result.managerGateMissed).toBe(false);
    expect(result.calculatedManagerBonus).toBe("10000");
  });

  it("gate fails and zeroes the bonus when the team's hit-rate is below the required ratio", () => {
    const ps = basePs({
      managerBonusEnabled: true,
      managerBonusAmount: "10000",
      managerGateEnabled: true,
      managerGateKpiThresholdPercent: "50",
      managerGateTeamRatioPercent: "100",
    });
    // Only 1 of 2 team members clears 50% - 50% team ratio < 100% required.
    const result = calculatePay(ps, orderData(), [60, 10]);
    expect(result.managerGateMissed).toBe(true);
    expect(result.calculatedManagerBonus).toBe("0");
  });

  it("an empty team (no direct reports) auto-passes the gate - nothing to fail on", () => {
    const ps = basePs({
      managerBonusEnabled: true,
      managerBonusAmount: "10000",
      managerGateEnabled: true,
      managerGateKpiThresholdPercent: "50",
      managerGateTeamRatioPercent: "100",
    });
    const result = calculatePay(ps, orderData(), []);
    expect(result.managerGateMissed).toBe(false);
    expect(result.calculatedManagerBonus).toBe("10000");
  });

  it("pays nothing when manager bonus is disabled", () => {
    const ps = basePs({ managerBonusEnabled: false, managerBonusAmount: "10000" });
    const result = calculatePay(ps, orderData(), [100, 100]);
    expect(result.calculatedManagerBonus).toBe("0");
    expect(result.managerGateMissed).toBeNull();
  });
});
