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
 * Three tiers, most-decisive first:
 *   1. Verdict  — did this period make money, and how did it add up
 *   2. Funnel   — did the orders actually land (the COD make-or-break)
 *   3. Ratios   — efficiency check numbers, dense and scannable
 * Everything a reader doesn't decide on sits in the context line at the foot.
 */

interface DashboardSummaryProps {
  dateFilter?: DateFilter;
  scope?: DashboardMetricsScope;
  viewMode?: DashboardViewMode;
  onMetricsLoaded?: (metrics: BusinessPerformanceMetrics) => void;
  /** Same metrics over the immediately preceding window; null when the range has no "previous". */
  priorMetrics?: BusinessPerformanceMetrics | null;
}

const HEALTH_DOT: Record<HealthBand, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

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

/** One cell of the dense ratio rail. Becomes a button when it has an explainer. */
function Stat({
  label,
  value,
  hint,
  band,
  onExplain,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  band?: HealthBand | null;
  onExplain?: () => void;
  delta?: ReactNode;
}) {
  const body = (
    <>
      <Caption>{label}</Caption>
      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={`text-xl font-semibold leading-none tabular-nums ${
            band ? healthTextClass(band) : "text-foreground"
          }`}
        >
          {value}
        </span>
        {delta}
      </span>
      {hint && (
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{hint}</span>
      )}
    </>
  );

  if (!onExplain) {
    return <div className="min-w-[8.5rem] flex-1 bg-card p-3.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onExplain}
      aria-label={`${label} — how this is calculated`}
      className="group relative min-w-[8.5rem] flex-1 cursor-pointer bg-card p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {band && (
        <span
          className={`absolute right-3 top-3.5 h-1.5 w-1.5 rounded-full ${HEALTH_DOT[band]}`}
          aria-hidden
        />
      )}
      <Info className="absolute bottom-3 right-3 h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      {body}
    </button>
  );
}

/** One term in the profit equation. */
function Term({
  op,
  label,
  value,
  emphasis,
  onExplain,
  delta,
}: {
  op?: string;
  label: string;
  value: string;
  emphasis?: boolean;
  onExplain?: () => void;
  delta?: ReactNode;
}) {
  const Tag = onExplain ? "button" : "div";
  return (
    <>
      {op && (
        <span className="shrink-0 self-center text-base text-muted-foreground" aria-hidden>
          {op}
        </span>
      )}
      <Tag
        {...(onExplain
          ? { type: "button" as const, onClick: onExplain, "aria-label": `${label} — how this is calculated` }
          : {})}
        className={`min-w-0 rounded-lg px-2.5 py-1.5 text-left ${
          emphasis ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""
        } ${onExplain ? "transition-colors hover:bg-muted" : ""}`}
      >
        <Caption>{label}</Caption>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={`whitespace-nowrap text-[15px] font-semibold tabular-nums ${
              emphasis ? "text-primary-text" : "text-foreground"
            }`}
          >
            {value}
          </span>
          {delta}
        </span>
      </Tag>
    </>
  );
}

export function DashboardSummary({
  dateFilter,
  scope = {},
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
  const deliveredPct = m.totalOrdersGenerated > 0 ? (m.totalOrdersDelivered / m.totalOrdersGenerated) * 100 : 0;

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

  return (
    <div className="space-y-3">
      {canViewExpenses && !hasAdSpend && m.totalOrdersGenerated > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No ad spend recorded for this period — CPA and ROAS are hidden. Profit still reflects
          delivered order economics.
        </p>
      )}

      {/* ---------- TIER 1 · the verdict ---------- */}
      {canViewExpenses && (
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
            <Caption>Total profit · delivered</Caption>
            {/* Deliberately --foreground, not health-tinted: at this size the figure
                does not need colour to be prominent, and the green it used to carry
                was 2.54:1 on a white card. Health now rides the delta chip. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[2.25rem] font-semibold leading-none tabular-nums text-foreground">
                {hasDelivered ? naira(m.totalProfit) : NO_VALUE}
              </p>
              <DeltaChip
                current={m.totalProfit}
                previous={priorMetrics?.totalProfit}
                enabled={hasActivity}
              />
            </div>
            {hasDelivered ? (
              <>
                <p className="mt-2.5 text-sm text-muted-foreground">
                  {m.totalOrdersDelivered.toLocaleString()} delivered order
                  {m.totalOrdersDelivered === 1 ? "" : "s"} ·{" "}
                  <span className="font-medium text-foreground">
                    {nairaOrDash(m.profitPerOrder, hasDelivered)}
                  </span>{" "}
                  each
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  on {naira(m.totalDeliveredSales)} of delivered sales
                </p>
              </>
            ) : (
              <p className="mt-2.5 text-sm text-muted-foreground">
                {hasGenerated
                  ? "No orders delivered in this period yet."
                  : "No orders in this period yet."}
              </p>
            )}
          </div>

          <div className="min-w-0 p-5">
            <Caption>How it adds up, per order</Caption>
            <div className="mt-2.5 flex flex-wrap items-stretch gap-x-1 gap-y-2">
              <Term
                label="AOV"
                value={nairaOrDash(m.averageOrderValue, hasDelivered)}
                onExplain={openExplainer("average_order_value")}
                delta={
                  <DeltaChip
                    current={m.averageOrderValue}
                    previous={priorMetrics?.averageOrderValue}
                    enabled={hasDelivered}
                  />
                }
              />
              {hasAdSpend && (
                <Term
                  op="−"
                  label="Real CPA"
                  value={nairaOrDash(m.realCpa, hasDelivered)}
                  onExplain={openExplainer("real_cpa")}
                />
              )}
              <Term
                op="−"
                label="COGS"
                value={nairaOrDash(m.averageCogs, hasDelivered)}
                onExplain={openExplainer("average_cogs")}
              />
              <Term
                op="−"
                label="Delivery"
                value={nairaOrDash(m.averageDeliveryFee, hasDelivered)}
                onExplain={openExplainer("average_delivery_fee")}
              />
              <Term
                op="="
                label="Profit per order"
                value={nairaOrDash(m.profitPerOrder, hasDelivered)}
                emphasis
                onExplain={openExplainer("profit_per_order")}
              />
              <Term
                op="×"
                label="Delivered"
                value={m.totalOrdersDelivered.toLocaleString()}
                onExplain={openExplainer("orders_delivered")}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------- TIER 2 · the funnel ---------- */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <Caption>Delivery rate</Caption>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <p
                className={`text-[1.75rem] font-semibold leading-none tabular-nums ${
                  hasGenerated ? healthTextClass(rateBand) : "text-muted-foreground"
                }`}
              >
                {percentOrDash(m.deliveryRate, hasGenerated)}
              </p>
              {/* A rate moves in percentage POINTS, never percent. */}
              <DeltaChip
                current={m.deliveryRate}
                previous={priorMetrics?.deliveryRate}
                unit="points"
                enabled={hasGenerated}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={openExplainer("delivery_rate")}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            How is this calculated?
          </button>
        </div>

        <div
          className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={
            hasGenerated
              ? `${m.totalOrdersDelivered} of ${m.totalOrdersGenerated} orders delivered`
              : "No orders in this period"
          }
        >
          {/* With zero generated orders the amber flex-1 segment used to fill the
              whole track, which reads as "everything failed". Leave it empty. */}
          {hasGenerated && (
            <>
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(deliveredPct, 100)}%` }}
              />
              <div className="h-full flex-1 bg-amber-500/60" />
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <button
            type="button"
            onClick={openExplainer("orders_generated")}
            className="flex items-center gap-1.5 rounded px-1 -mx-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="font-semibold tabular-nums text-foreground">
              {m.totalOrdersGenerated.toLocaleString()}
            </span>
            generated
          </button>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">
              {m.totalOrdersDelivered.toLocaleString()}
            </span>
            delivered
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-500/60" aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">
              {undelivered.toLocaleString()}
            </span>
            still out
          </span>
        </div>
      </div>

      {/* ---------- TIER 3 · efficiency ratios ---------- */}
      {canViewExpenses && (
        <div className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
          {hasAdSpend && (
            <Stat
              label="ROAS"
              value={ratio(m.roas, hasAdSpend)}
              hint="Delivered revenue ÷ ad spend"
              band={roasHealth}
              onExplain={openExplainer("roas")}
              delta={
                <DeltaChip current={m.roas} previous={priorMetrics?.roas} enabled={hasAdSpend} />
              }
            />
          )}
          {isBusinessView && (
            <Stat
              label="Business ROI"
              value={ratio(m.businessRoi, hasInvestment)}
              hint="Net ÷ total investment"
              band={roiHealth}
              onExplain={openExplainer("business_roi")}
            />
          )}
          {hasAdSpend && (
            <>
              <Stat
                label="Platform CPA"
                value={nairaOrDash(m.platformCpa, hasGenerated)}
                hint="Ad spend ÷ generated"
                onExplain={openExplainer("platform_cpa")}
              />
              <Stat
                label="Real CPA"
                value={nairaOrDash(m.realCpa, hasDelivered)}
                hint={
                  m.cpaGap > 0 ? `${naira(m.cpaGap)} worse than platform` : "Ad spend ÷ delivered"
                }
                band={cpaHealth}
                onExplain={openExplainer("real_cpa")}
              />
            </>
          )}
          <Stat
            label="Ad spend"
            value={naira(m.adSpend)}
            onExplain={openExplainer("ad_spend")}
          />
          {isBusinessView && m.totalNonAdExpenses > 0 && (
            <Stat
              label="Other expenses"
              value={naira(m.totalNonAdExpenses)}
              hint="Non-ad operational costs"
              onExplain={openExplainer("other_expenses")}
            />
          )}
        </div>
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
