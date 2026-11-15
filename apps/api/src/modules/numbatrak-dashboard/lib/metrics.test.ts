import { describe, expect, it } from "vitest";
import { computeLossMetrics } from "./metrics.js";
import type { MetricsOrderRow } from "./order-rows.js";

function order(over: Partial<MetricsOrderRow>): MetricsOrderRow {
  return {
    id: Math.random().toString(36).slice(2),
    status: "failed",
    createdAt: "2026-11-10T10:00:00.000Z",
    completedAt: null,
    orderRevenue: 10_000,
    orderCost: 0,
    deliveryFee: 0,
    profit: 0,
    agentId: null,
    ...over,
  };
}

describe("computeLossMetrics byFunnel", () => {
  it("groups undelivered orders by form, biggest first, naming missing forms", () => {
    const result = computeLossMetrics({
      orders: [
        order({ formId: "f_c" }),
        order({ formId: "f_c", orderRevenue: 5_000 }),
        order({ formId: "f_demo" }),
        order({ formId: null }), // manual order, no form
        order({ formId: "f_gone" }), // form deleted since
        order({ formId: "f_demo", status: "delivered" }), // delivered: not a loss
        order({ formId: "f_demo", status: "cancelled" }), // cancelled: never generated
      ],
      adSpend: 0,
      failedDeliveryCost: 0,
      forms: [
        { id: "f_c", name: "Angle C" },
        { id: "f_demo", name: "Demo" },
      ],
    });

    expect(result.byFunnel).toEqual([
      { formId: "f_c", label: "Angle C", count: 2, wouldBeSales: 15_000 },
      { formId: "f_demo", label: "Demo", count: 1, wouldBeSales: 10_000 },
      { formId: null, label: "No form", count: 1, wouldBeSales: 10_000 },
      { formId: "f_gone", label: "Deleted form", count: 1, wouldBeSales: 10_000 },
    ]);
  });
});
