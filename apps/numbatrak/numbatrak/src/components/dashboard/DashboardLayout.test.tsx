/**
 * Render cover for the spec-shaped dashboard sections: the right blocks show
 * in the right view, and the derived figures (real cost per failed order,
 * expense shares, ROI as a percentage) come out as the spec mock shows them.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { EMPTY_BUSINESS_METRICS, EMPTY_LOSS_METRICS } from "../../services/dashboardMetrics";

const metrics = {
  ...EMPTY_BUSINESS_METRICS,
  totalOrdersGenerated: 246,
  totalOrdersDelivered: 150,
  deliveryRate: 61,
  totalDeliveredSales: 4_815_000,
  averageOrderValue: 32_100,
  adSpend: 2_000_000,
  platformCpa: 8_130,
  realCpa: 13_333,
  cpaGap: 5_200,
  totalCogs: 880_000,
  averageCogs: 5_870,
  totalDeliveryFees: 310_000,
  averageDeliveryFee: 2_070,
  profitPerOrder: 9_400,
  totalProfit: 1_410_000,
  roas: 2.4,
  businessRoi: 0.29,
  totalNonAdExpenses: 220_000,
  totalInvestment: 2_220_000,
  netProfitAfterAllExpenses: 1_405_000,
};

const funnelRows = [
  { key: "a", mediaBuyerName: "Kayode", platform: "TikTok", offerLabel: "62k", orderCount: 58, revenue: 1_800_000, cost: 0, profit: 900_000, spend: 720_000, averageOrderValue: 31_000 },
  { key: "b", mediaBuyerName: "Tunde", platform: "Facebook", offerLabel: null, orderCount: 54, revenue: 1_700_000, cost: 0, profit: -20_000, averageOrderValue: 31_500 },
];
const fetchFunnelBreakdown = vi.fn(async () => funnelRows);

vi.mock("../../services/dashboardMetrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/dashboardMetrics")>()),
  fetchBusinessPerformanceMetrics: vi.fn(async () => metrics),
  fetchFunnelBreakdown: (...args: unknown[]) => fetchFunnelBreakdown(...(args as [])),
}));
// One object, as the real context provides - a fresh one per call would
// re-trigger the summary's load effect on every render.
const org = { id: "org_1", name: "Test Org" };
vi.mock("../../contexts/OrganizationContext", () => ({
  useOrganization: () => ({ currentOrganization: org }),
}));
vi.mock("../../hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyRole: () => true, hasPermission: () => true }),
}));
vi.mock("../../services/dashboardAlertSettings", async () => {
  const { DEFAULT_DASHBOARD_ALERT_THRESHOLDS } = await import("../../constants/dashboardAlerts");
  return { loadDashboardAlertThresholds: vi.fn(async () => DEFAULT_DASHBOARD_ALERT_THRESHOLDS) };
});

import { DashboardSummary } from "./DashboardSummary";
import { LossPanel } from "./LossPanel";
import { FunnelBreakdownTable } from "./FunnelBreakdownTable";

const ngn = (v: number) => `₦${Math.round(v).toLocaleString()}`;

describe("DashboardSummary (spec layout)", () => {
  it("business view: hero, core metrics, profit bars, ROAS vs ROI and expenses", async () => {
    render(<DashboardSummary viewMode="business" />);
    expect(await screen.findByText("Total profit · delivered orders")).toBeTruthy();
    expect(screen.getByText("The core metrics")).toBeTruthy();
    expect(screen.getByText("Real / Platform CPA")).toBeTruthy();
    expect(screen.getByText("gap ₦5.2k hidden")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Profit \/ order/ })).toBeTruthy();
    expect(screen.getByText("29%")).toBeTruthy(); // ROI as a percentage, not 0.29×
    expect(screen.getByText("ROAS vs Business ROI")).toBeTruthy();
    // Advertising ₦2.0M of ₦4.815M delivered = 42%.
    const ad = screen.getByText("Advertising").closest("tr")!;
    expect(ad.textContent).toContain("42%");
  });

  it("funnel view leaves out ROAS vs ROI and the expense table", async () => {
    render(<DashboardSummary viewMode="funnel" />);
    expect(await screen.findByText("The core metrics")).toBeTruthy();
    expect(screen.queryByText("ROAS vs Business ROI")).toBeNull();
    expect(screen.queryByText("All expenses")).toBeNull();
  });
});

describe("LossPanel (spec layout)", () => {
  it("shows the five headline figures and real cost per failed order", () => {
    render(
      <LossPanel
        formatCurrency={ngn}
        totalOrdersGenerated={246}
        metrics={{
          ...EMPTY_LOSS_METRICS,
          undeliveredCount: 96,
          wouldBeSales: 3_080_000,
          allocatedAdSpend: 780_000,
          failedDeliveryCost: 96_000,
          byLocation: [{ location: "ikorodu", label: "Ikorodu", count: 33, wouldBeSales: 1 }],
          byStatus: [{ status: "failed", label: "Failed", count: 52, wouldBeSales: 1 }],
          byFunnel: [{ formId: "f_c", label: "Angle C", count: 36, wouldBeSales: 1 }],
        }}
      />,
    );
    expect(screen.getByText("96 / 246")).toBeTruthy();
    expect(screen.getByText("₦9,125")).toBeTruthy(); // (780k + 96k) ÷ 96
    expect(screen.getByText("34%")).toBeTruthy(); // 33 of 96
    expect(screen.getByText("By agent")).toBeTruthy();
    expect(screen.getByText("Angle C")).toBeTruthy();
    expect(screen.getByText("38%")).toBeTruthy(); // 36 of 96
    expect(screen.queryByText("By product")).toBeNull(); // only when there are products
  });
});

describe("FunnelBreakdownTable", () => {
  it("defaults to delivered orders and applies the platform filter locally", async () => {
    render(<FunnelBreakdownTable organizationId="org_1" scope={{ platform: "TikTok" }} formatCurrency={ngn} />);
    expect(await screen.findByText("Kayode · TikTok · 62k")).toBeTruthy();
    expect(screen.queryByText(/Tunde/)).toBeNull();
    const [, , , serverScope] = fetchFunnelBreakdown.mock.calls[0] as unknown as [string, unknown, unknown, Record<string, unknown>];
    expect(serverScope.status).toBe("delivered");
    expect(serverScope.platform).toBeUndefined();
  });

  it("shows spend, real CPA, ROAS and profit after ads", async () => {
    render(<FunnelBreakdownTable organizationId="org_1" scope={{}} formatCurrency={ngn} />);
    const row = (await screen.findByText("Kayode · TikTok · 62k")).closest("tr")!;
    expect(row.textContent).toContain("₦720,000"); // spend
    expect(row.textContent).toContain("₦12,414"); // 720k ÷ 58
    expect(row.textContent).toContain("2.5×"); // 1.8M ÷ 720k
    expect(row.textContent).toContain("₦180,000"); // 900k − 720k
    // A row with no spend shows dashes, not ₦0 / Infinity.
    const tunde = screen.getByText("Tunde · Facebook · Whole form").closest("tr")!;
    expect(tunde.textContent).not.toContain("Infinity");
    expect(tunde.textContent).toContain("\u2014");
  });
});

import { DashboardFilters } from "./DashboardFilters";
import userEvent from "@testing-library/user-event";

describe("DashboardFilters custom range", () => {
  const noop = () => {};
  const baseValues = {
    dateFilter: { type: "last_30_days" as const },
    formId: null, csrId: null, offerName: null, agentId: null,
    status: null, platform: null, mediaBuyerName: null, trackingLinkId: null, viewMode: "funnel" as const,
  };
  const props = {
    onCustomStartDateChange: noop, onCustomEndDateChange: noop, onDateFilterChange: noop,
    onFormChange: noop, onCsrChange: noop, onOfferChange: noop,
    onAgentChange: noop, onStatusChange: noop, onPlatformChange: noop, onMediaBuyerChange: noop,
    onTrackingLinkChange: noop, onViewModeChange: noop,
    forms: [], csrUsers: [], agents: [], offerNames: [], platforms: [],
    mediaBuyerNames: [], trackingLinkOptions: [],
  };

  it("has a Custom button next to the presets that applies the range", async () => {
    const onApply = vi.fn();
    render(
      <DashboardFilters {...(props as any)} values={baseValues} customStartDate="2026-11-01" customEndDate="2026-11-14" onCustomDateApply={onApply} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Custom/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("won't apply a range that ends before it starts", async () => {
    render(
      <DashboardFilters {...(props as any)} values={baseValues} customStartDate="2026-11-14" customEndDate="2026-11-01" onCustomDateApply={noop} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Custom/ }));
    expect(await screen.findByText("The start date is after the end date.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("labels the button with the applied range", () => {
    render(
      <DashboardFilters
        {...(props as any)}
        values={{ ...baseValues, dateFilter: { type: "custom", startDate: "2026-11-01", endDate: "2026-11-14" } }}
        customStartDate="2026-11-01"
        customEndDate="2026-11-14"
        onCustomDateApply={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "1 Nov – 14 Nov" })).toBeTruthy();
  });
});

import { resolveDateRange } from "../../utils/dateRange";

describe("resolveDateRange custom", () => {
  it("starts at local midnight of the picked day", () => {
    const { startDate, endDate } = resolveDateRange({ type: "custom", startDate: "2026-11-01", endDate: "2026-11-14" });
    const start = new Date(startDate!);
    const end = new Date(endDate!);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 1, 0]);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([14, 23, 59]);
  });
});
