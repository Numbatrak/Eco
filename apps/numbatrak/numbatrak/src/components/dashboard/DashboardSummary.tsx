import { useEffect, useState, type ReactNode } from "react";
import { Info, RefreshCw } from "lucide-react";
import {
  fetchBusinessPerformanceMetrics,
  BusinessPerformanceMetrics,
  EMPTY_BUSINESS_METRICS,
  DashboardMetricsScope,
} from "../../services/dashboardMetrics";
import { usePermissions } from "../../hooks/usePermissions";
import { useOrganization } from "../../contexts/OrganizationContext";
import { resolveDateRange, type DateFilter } from "../../utils/dateRange";
import type { DashboardViewMode } from "../../types/dashboardFilters";
import {
  deliveryRateBandWithThresholds,
  roasBandWithThresholds,
  businessRoiBandWithThresholds,
  realCpaBandWithThresholds,
  healthTextClass,
  type HealthBand,
} from "../../utils/dashboardHealth";
import { loadDashboardAlertThresholds } from "../../services/dashboardAlertSettings";
import type { DashboardAlertThresholds } from "../../constants/dashboardAlerts";
import { DEFAULT_DASHBOARD_ALERT_THRESHOLDS } from "../../constants/dashboardAlerts";
import { MetricExplainerDialog } from "./MetricExplainerDialog";
import type { MetricExplainerKey } from "../../constants/metricExplainers";

/**
 * Laid out after the dashboard spec (numbatrak_dashboard_spec_exact.html):
 *   1. Hero      — total profit on delivered orders, with ROAS and delivery rate
 *   2. Core      — the per-order metrics as a tile grid
 *   3. Profit    — AOV − CPA − COGS − delivery = profit per order, as bars
 *   4. Business  — (business view only) ROAS vs Business ROI, and every expense
 * The loss panel and the per-funnel table sit below, in DashboardPage.
 */

interface DashboardSummaryProps {
  dateFilter?: DateFilter;
  scope?: DashboardMetricsScope;
  viewMode?: DashboardViewMode;
  onMetricsLoaded?: (metrics: BusinessPerformanceMetrics) => void;
  /** Same metrics over the immediately preceding window; null when the range has no "previous". */
  priorMetrics?: BusinessPerformanceMetrics | null;
}

/** Em-dash, used wherever a figure is genuinely unknown rather than zero. */
const NO_VALUE = "\u2014";

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const naira = (value: number) => nairaFormatter.format(value);

/**
 * Money that has a denominator behind it (an average, a cost per order).
 *
 * With no orders there is no average - the honest answer is "—", not ₦0. A
 * displayed zero reads as "we sold things and made nothing", which is a very
 * different business situation from "nothing happened in this period".
 * Presentation only: no calculation changes, this just refuses to render a
 * figure the data can't support.
 */
const nairaOrDash = (value: number, hasDenominator: boolean) =>
  hasDenominator && Number.isFinite(value) ? naira(value) : NO_VALUE;

const ratio = (value: number, hasDenominator = true) =>
  hasDenominator && Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}×` : NO_VALUE;

const percentOrDash = (value: number, hasDenominator: boolean) =>
  hasDenominator && Number.isFinite(value) ? `${value.toFixed(1)}%` : NO_VALUE;

/**
 * Period-over-period change.
 *
 * `unit` matters: a delivery rate moving 68% -> 70% changed by 2 percentage
 * POINTS, not by 2.9 percent, and conflating the two is how dashboards end up
 * overstating movement. Rates pass "points"; money and ratios pass "percent".
 *
 * Renders nothing when there is no usable prior value — a missing previous
 * period, or a zero baseline that would divide to Infinity.
 */
function DeltaChip({
  current,
  previous,
  unit = "percent",
  /** When true, a decrease is the good outcome (CPA, cost per order). */
  lowerIsBetter = false,
  /** False in a period with no activity, where "▼ 100%" would be noise, not news. */
  enabled = true,
}: {
  current: number;
  previous: number | null | undefined;
  unit?: "percent" | "points";
  lowerIsBetter?: boolean;
  enabled?: boolean;
}) {
  if (!enabled) return null;
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (unit === "percent" && previous === 0) return null;

  const change = unit === "points" ? current - previous : ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(change) || Math.abs(change) < 0.05) return null;

  const rising = change > 0;
  const good = lowerIsBetter ? !rising : rising;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums ${
        good ? "text-primary-text" : "text-danger-text"
      }`}
      title={`vs the previous period`}
    >
      <span aria-hidden>{rising ? "\u25B2" : "\u25BC"}</span>
      {Math.abs(change).toFixed(1)}
      {unit === "points" ? " pts" : "%"}
    </span>
  );
}

/** Small uppercase caption used on every tile. */
function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

/** Section heading with a hairline rule, as in the dashboard spec. */
function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden />
      {aside}
    </div>
  );
}

/** One tile in the core-metrics grid. Becomes a button when it has an explainer. */
function MetricTile({
  label,
  value,
  secondary,
  hint,
  band,
  emphasis,
  onExplain,
  delta,
}: {
  label: string;
  value: string;
  /** Smaller figure after the value, e.g. "/ ₦8.1k" platform CPA. */
  secondary?: string;
  hint?: string;
  band?: HealthBand | null;
  emphasis?: boolean;
  onExplain?: () => void;
  delta?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={`text-xl font-semibold leading-none tabular-nums ${
            band ? healthTextClass(band) : emphasis ? "text-primary-text" : "text-foreground"
          }`}
        >
          {value}
        </span>
        {secondary && <span className="text-xs font-medium tabular-nums text-muted-foreground">{secondary}</span>}
        {delta}
      </span>
      <span className="mt-1.5 block text-xs text-foreground/80">{label}</span>
      {hint && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>}
    </>
  );
  const tone = band
    ? band === "red"
      ? "border-red-500/30 bg-red-500/5"
      : band === "amber"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card"
    : emphasis
      ? "border-primary/30 bg-primary/5"
      : "border-border bg-card";
  const className = `group relative min-w-0 rounded-xl border p-3.5 text-left ${tone}`;

  if (!onExplain) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onExplain}
      aria-label={`${label} — how this is calculated`}
      className={`${className} cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
    >
      <Info className="absolute right-3 top-3 h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      {body}
    </button>
  );
}

/** Compact naira for chart labels: ₦32.1k, ₦1.4M. */
function compactNaira(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₦${Math.round(abs)}`;
}

type ProfitBar = { label: string; value: number; barClass: string; op?: string };

/**
 * AOV − Real CPA − COGS − Delivery = Profit per order, as bars scaled to AOV.
 * A negative profit draws no bar; its label turns red instead.
 */
function ProfitBars({ bars }: { bars: ProfitBar[] }) {
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div
        className="flex items-end gap-1 sm:gap-2"
        role="img"
        aria-label={bars.map((b) => `${b.op ?? ""} ${b.label} ${compactNaira(b.value)}`).join(", ")}
      >
        {bars.map((bar) => (
          <div key={bar.label} className="flex min-w-0 flex-1 items-end gap-1 sm:gap-2">
            {bar.op && (
              <span className="mb-8 shrink-0 text-sm text-muted-foreground" aria-hidden>
                {bar.op}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <span
                className={`mb-1 whitespace-nowrap text-xs font-semibold tabular-nums ${
                  bar.value < 0 ? "text-danger-text" : "text-foreground"
                }`}
              >
                {compactNaira(bar.value)}
              </span>
              <div className="flex h-28 w-full items-end">
                <div
                  className={`w-full rounded-t-md ${bar.barClass}`}
                  style={{ height: `${Math.max((Math.max(bar.value, 0) / max) * 100, bar.value > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="mt-1.5 truncate text-[11px] text-muted-foreground">{bar.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stable default: a fresh `{}` per render would re-trigger the load effect forever. */
const NO_SCOPE: DashboardMetricsScope = {};

export function DashboardSummary({
  dateFilter,
  scope = NO_SCOPE,
  viewMode = "business",
  onMetricsLoaded,
  priorMetrics = null,
}: DashboardSummaryProps) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<BusinessPerformanceMetrics | null>(null);
  const [thresholds, setThresholds] = useState<DashboardAlertThresholds>(
    DEFAULT_DASHBOARD_ALERT_THRESHOLDS
  );
  const [explainerKey, setExplainerKey] = useState<MetricExplainerKey | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracked separately from "metrics are empty". A failed request must never be
  // rendered as a real zero - a ₦0 profit and a 0% delivery rate are indistinguishable
  // from a catastrophic day, which is the most trust-destroying thing a dashboard can do.
  const [loadError, setLoadError] = useState(false);
  const { hasAnyRole } = usePermissions();

  const canViewExpenses = hasAnyRole(["Manager", "Admin", "Owner"]);
  const isBusinessView = viewMode === "business";
  const hasAdSpend = (metrics?.adSpend ?? 0) > 0;

  useEffect(() => {
    if (!currentOrganization) return;
    let cancelled = false;
    loadDashboardAlertThresholds(currentOrganization.id).then((loaded) => {
      if (!cancelled) setThresholds(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization) {
      loadStats();
    }
  }, [currentOrganization, dateFilter, scope, viewMode]);

  const loadStats = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setLoadError(false);
      const { startDate, endDate } = resolveDateRange(dateFilter);

      const perf = await fetchBusinessPerformanceMetrics(
        currentOrganization.id,
        startDate,
        endDate,
        scope
      );
      setMetrics(perf);
      onMetricsLoaded?.(perf);
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
      // Deliberately does NOT publish empty metrics: downstream alerts would
      // otherwise fire on fabricated zeroes.
      setLoadError(true);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const openExplainer = (key: MetricExplainerKey) => () => setExplainerKey(key);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        {canViewExpenses && (
          <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Caption>Total profit · delivered</Caption>
            <p className="mt-2 text-[2.25rem] font-semibold leading-none text-muted-foreground">
              &mdash;
            </p>
            <p className="mt-2.5 text-sm text-muted-foreground">
              Couldn&apos;t load these figures. They have not been set to zero &mdash; the numbers are unknown.
            </p>
          </div>
          <button
            type="button"
            onClick={loadStats}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const m = metrics ?? EMPTY_BUSINESS_METRICS;
  const rateBand = deliveryRateBandWithThresholds(m.deliveryRate, thresholds);
  const roasHealth = roasBandWithThresholds(m.roas, hasAdSpend, thresholds);
  const roiHealth = businessRoiBandWithThresholds(m.businessRoi, m.totalInvestment > 0, thresholds);
  const cpaHealth = realCpaBandWithThresholds(
    m.realCpa,
    m.averageOrderValue,
    hasAdSpend,
    thresholds
  );

  const undelivered = Math.max(m.totalOrdersGenerated - m.totalOrdersDelivered, 0);

  // Which denominators actually exist this period. Every ratio below is gated on
  // one of these so an empty period shows "—" rather than a fabricated zero.
  const hasGenerated = m.totalOrdersGenerated > 0;
  const hasDelivered = m.totalOrdersDelivered > 0;
  const hasActivity = hasGenerated || hasDelivered;
  const hasInvestment = m.totalInvestment > 0;

  const profitWaterfallValues: Partial<Record<string, string>> = {
    "Average order value (AOV)": naira(m.averageOrderValue),
    "− Real CPA (ad cost per delivery)": naira(m.realCpa),
    "− Average COGS": naira(m.averageCogs),
    "− Average delivery fee": naira(m.averageDeliveryFee),
    "= Profit per order": naira(m.profitPerOrder),
    "Profit per order": naira(m.profitPerOrder),
    "× Delivered orders": m.totalOrdersDelivered.toLocaleString(),
    "= Total profit": naira(m.totalProfit),
  };

  const roiPct = hasInvestment ? `${(m.businessRoi * 100).toFixed(0)}%` : NO_VALUE;
  const expenseRows = [
    { label: "Advertising", amount: m.adSpend },
    { label: "Product cost (delivered)", amount: m.totalCogs },
    { label: "Delivery", amount: m.totalDeliveryFees },
    { label: "Operational & other", amount: m.totalNonAdExpenses },
  ];
  const expenseTotal = expenseRows.reduce((sum, r) => sum + r.amount, 0);
  const shareOfRevenue = (amount: number) =>
    m.totalDeliveredSales > 0 ? `${((amount / m.totalDeliveredSales) * 100).toFixed(0)}%` : NO_VALUE;

  const profitBars: ProfitBar[] = [
    { label: "AOV", value: m.averageOrderValue, barClass: "bg-foreground/25" },
    ...(hasAdSpend ? [{ op: "−", label: "Real CPA", value: m.realCpa, barClass: "bg-red-500/70" }] : []),
    { op: "−", label: "COGS", value: m.averageCogs, barClass: "bg-amber-500/70" },
    { op: "−", label: "Delivery", value: m.averageDeliveryFee, barClass: "bg-sky-500/70" },
    { op: "=", label: "Profit / order", value: m.profitPerOrder, barClass: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      {canViewExpenses && !hasAdSpend && m.totalOrdersGenerated > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No ad spend recorded for this period — CPA and ROAS don&apos;t apply. The profit picture still shows.
        </p>
      )}

      {/* ---------- Hero · total profit ---------- */}
      {canViewExpenses && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-xl border border-border bg-card p-5">
          <div className="min-w-0">
            <Caption>Total profit · delivered orders</Caption>
            {/* Deliberately --foreground, not health-tinted: at this size the figure
                does not need colour to be prominent. Health rides the delta chip. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[2.25rem] font-semibold leading-none tabular-nums text-foreground">
                {hasDelivered ? naira(m.totalProfit) : NO_VALUE}
              </p>
              <DeltaChip current={m.totalProfit} previous={priorMetrics?.totalProfit} enabled={hasActivity} />
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground">
              {hasDelivered ? (
                <>
                  profit per order{" "}
                  <span className="font-medium text-foreground">{naira(m.profitPerOrder)}</span> ×{" "}
                  {m.totalOrdersDelivered.toLocaleString()} delivered
                </>
              ) : hasGenerated ? (
                "No orders delivered in this period yet."
              ) : (
                "No orders in this period yet."
              )}
            </p>
          </div>
          <div className="flex gap-6">
            {hasAdSpend && (
              <button type="button" onClick={openExplainer("roas")} className="text-right">
                <span className={`block text-2xl font-semibold leading-none tabular-nums ${healthTextClass(roasHealth ?? "green")}`}>
                  {ratio(m.roas, hasAdSpend)}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">ROAS</span>
              </button>
            )}
            <button type="button" onClick={openExplainer("delivery_rate")} className="text-right">
              <span
                className={`block text-2xl font-semibold leading-none tabular-nums ${
                  hasGenerated ? healthTextClass(rateBand) : "text-muted-foreground"
                }`}
              >
                {percentOrDash(m.deliveryRate, hasGenerated)}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">delivery rate</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------- The core metrics ---------- */}
      <section className="space-y-2.5">
        <SectionTitle>The core metrics</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <MetricTile
            label="Orders generated"
            value={m.totalOrdersGenerated.toLocaleString()}
            onExplain={openExplainer("orders_generated")}
            delta={<DeltaChip current={m.totalOrdersGenerated} previous={priorMetrics?.totalOrdersGenerated} enabled={hasActivity} />}
          />
          <MetricTile
            label="Orders delivered"
            value={m.totalOrdersDelivered.toLocaleString()}
            hint={undelivered > 0 ? `${undelivered.toLocaleString()} still out` : undefined}
            onExplain={openExplainer("orders_delivered")}
          />
          <MetricTile
            label="Delivery rate"
            value={percentOrDash(m.deliveryRate, hasGenerated)}
            hint="delivered ÷ generated"
            band={hasGenerated ? rateBand : null}
            onExplain={openExplainer("delivery_rate")}
            /* A rate moves in percentage POINTS, never percent. */
            delta={<DeltaChip current={m.deliveryRate} previous={priorMetrics?.deliveryRate} unit="points" enabled={hasGenerated} />}
          />
          {canViewExpenses && (
            <>
              <MetricTile
                label="AOV · delivered"
                value={nairaOrDash(m.averageOrderValue, hasDelivered)}
                hint="sales ÷ delivered"
                onExplain={openExplainer("average_order_value")}
                delta={<DeltaChip current={m.averageOrderValue} previous={priorMetrics?.averageOrderValue} enabled={hasDelivered} />}
              />
              <MetricTile
                label="Real / Platform CPA"
                value={hasAdSpend ? nairaOrDash(m.realCpa, hasDelivered) : NO_VALUE}
                secondary={hasAdSpend && hasGenerated ? `/ ${compactNaira(m.platformCpa)}` : undefined}
                hint={hasAdSpend ? (m.cpaGap > 0 ? `gap ${compactNaira(m.cpaGap)} hidden` : "ad spend ÷ delivered") : "no ad spend recorded"}
                band={hasAdSpend && hasDelivered ? cpaHealth : null}
                onExplain={openExplainer("real_cpa")}
                delta={<DeltaChip current={m.realCpa} previous={priorMetrics?.realCpa} lowerIsBetter enabled={hasAdSpend && hasDelivered} />}
              />
              <MetricTile
                label="Avg COGS · delivered"
                value={nairaOrDash(m.averageCogs, hasDelivered)}
                hint="bundles counted"
                onExplain={openExplainer("average_cogs")}
              />
              <MetricTile
                label="Avg delivery fee"
                value={nairaOrDash(m.averageDeliveryFee, hasDelivered)}
                onExplain={openExplainer("average_delivery_fee")}
              />
              <MetricTile
                label="Profit per order"
                value={nairaOrDash(m.profitPerOrder, hasDelivered)}
                hint="AOV − CPA − COGS − delivery"
                emphasis
                onExplain={openExplainer("profit_per_order")}
              />
            </>
          )}
        </div>
      </section>

      {canViewExpenses && hasDelivered && <ProfitBars bars={profitBars} />}

      {/* ---------- Business-level only: ROAS vs ROI, and every expense ---------- */}
      {canViewExpenses && isBusinessView && (
        <>
          <section className="space-y-2.5">
            <SectionTitle aside={<span className="text-[11px] text-muted-foreground">never merged</span>}>
              ROAS vs Business ROI
            </SectionTitle>
            <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2">
              <button
                type="button"
                onClick={openExplainer("roas")}
                className="border-b border-border p-4 text-left transition-colors hover:bg-muted/50 sm:border-b-0 sm:border-r"
              >
                <span className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold tabular-nums ${roasHealth ? healthTextClass(roasHealth) : "text-foreground"}`}>
                    {ratio(m.roas, hasAdSpend)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">ROAS · the ads</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {hasAdSpend
                    ? `${compactNaira(m.totalDeliveredSales)} delivered ÷ ${compactNaira(m.adSpend)} ad spend`
                    : "No ad spend recorded"}
                </span>
              </button>
              <button
                type="button"
                onClick={openExplainer("business_roi")}
                className="p-4 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold tabular-nums ${roiHealth ? healthTextClass(roiHealth) : "text-foreground"}`}>
                    {roiPct}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Business ROI · the business</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {hasInvestment
                    ? `${compactNaira(m.netProfitAfterAllExpenses)} net profit ÷ ${compactNaira(m.totalInvestment)} spent`
                    : "No spend recorded"}
                </span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              ROAS measures the ads on their own. Business ROI takes every expense into account, so the gap
              between the two is your operating cost.
            </p>
          </section>

          <section className="space-y-2.5">
            <SectionTitle aside={<span className="text-[11px] text-muted-foreground">4 categories</span>}>
              All expenses
            </SectionTitle>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5 text-right font-medium">% of revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((row) => (
                    <tr key={row.label} className="border-b border-border">
                      <td className="px-4 py-2.5 text-foreground">{row.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{naira(row.amount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{shareOfRevenue(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-4 py-2.5 text-foreground">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{naira(expenseTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{shareOfRevenue(expenseTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <MetricExplainerDialog
        explainerKey={explainerKey}
        open={explainerKey != null}
        onOpenChange={(open) => !open && setExplainerKey(null)}
        liveValues={profitWaterfallValues}
      />
    </div>
  );
}
