import { useEffect, useState } from "react";
import { KPICard } from "../KPICard";
import {
  UserCircle2,
  Package,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Target,
  Truck,
  Percent,
  BarChart3,
  Scale,
  PieChart,
  ShoppingBag,
  Info,
} from "lucide-react";
import { fetchDashboardOrgCounts } from "../../services/dashboard";
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
  profitPerOrderBandWithThresholds,
  businessRoiBandWithThresholds,
  realCpaBandWithThresholds,
  healthTextClass,
} from "../../utils/dashboardHealth";
import { loadDashboardAlertThresholds } from "../../services/dashboardAlertSettings";
import type { DashboardAlertThresholds } from "../../constants/dashboardAlerts";
import { DEFAULT_DASHBOARD_ALERT_THRESHOLDS } from "../../constants/dashboardAlerts";
import { MetricExplainerDialog } from "./MetricExplainerDialog";
import type { MetricExplainerKey } from "../../constants/metricExplainers";

interface DashboardSummaryProps {
  dateFilter?: DateFilter;
  scope?: DashboardMetricsScope;
  viewMode?: DashboardViewMode;
  onMetricsLoaded?: (metrics: BusinessPerformanceMetrics) => void;
}

const KPI_GRID_CLASS = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

export function DashboardSummary({
  dateFilter,
  scope = {},
  viewMode = "business",
  onMetricsLoaded,
}: DashboardSummaryProps) {
  const { currentOrganization } = useOrganization();
  const [orgCounts, setOrgCounts] = useState({
    totalAgents: 0,
    totalProducts: 0,
  });
  const [metrics, setMetrics] = useState<BusinessPerformanceMetrics | null>(
    null
  );
  const [thresholds, setThresholds] = useState<DashboardAlertThresholds>(
    DEFAULT_DASHBOARD_ALERT_THRESHOLDS
  );
  const [explainerKey, setExplainerKey] = useState<MetricExplainerKey | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { hasAnyRole } = usePermissions();

  const canViewExpenses = hasAnyRole(["Manager", "Admin", "Owner"]);
  const isBusinessView = viewMode === "business";
  const hasAdSpend = (metrics?.adSpend ?? 0) > 0;

  useEffect(() => {
    if (currentOrganization) {
      setThresholds(loadDashboardAlertThresholds(currentOrganization.id));
    }
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
      const { startDate, endDate } = resolveDateRange(dateFilter);

      const [perf, counts] = await Promise.all([
        fetchBusinessPerformanceMetrics(
          currentOrganization.id,
          startDate,
          endDate,
          scope
        ),
        fetchDashboardOrgCounts(currentOrganization.id),
      ]);
      setOrgCounts(counts);
      setMetrics(perf);
      onMetricsLoaded?.(perf);
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
      setMetrics(EMPTY_BUSINESS_METRICS);
      onMetricsLoaded?.(EMPTY_BUSINESS_METRICS);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatRatio = (value: number) =>
    value > 0 ? `${value.toFixed(2)}×` : "N/A";

  const openExplainer = (key: MetricExplainerKey) => () => setExplainerKey(key);

  if (loading) {
    const skeletonCount = canViewExpenses ? (isBusinessView ? 15 : 12) : 5;
    return (
      <div className={KPI_GRID_CLASS}>
        {[...Array(skeletonCount)].map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-6 animate-pulse min-w-0"
          >
            <div className="h-4 bg-muted rounded w-3/4 mb-4" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const m = metrics ?? EMPTY_BUSINESS_METRICS;
  const rateBand = deliveryRateBandWithThresholds(m.deliveryRate, thresholds);
  const roasHealth = roasBandWithThresholds(m.roas, hasAdSpend, thresholds);
  const profitHealth = profitPerOrderBandWithThresholds(
    m.profitPerOrder,
    thresholds
  );
  const roiHealth = businessRoiBandWithThresholds(
    m.businessRoi,
    m.totalInvestment > 0,
    thresholds
  );
  const cpaHealth = realCpaBandWithThresholds(
    m.realCpa,
    m.averageOrderValue,
    hasAdSpend,
    thresholds
  );

  const profitWaterfallValues: Partial<Record<string, string>> = {
    "Average order value (AOV)": formatCurrency(m.averageOrderValue),
    "− Real CPA (ad cost per delivery)": formatCurrency(m.realCpa),
    "− Average COGS": formatCurrency(m.averageCogs),
    "− Average delivery fee": formatCurrency(m.averageDeliveryFee),
    "= Profit per order": formatCurrency(m.profitPerOrder),
    "Profit per order": formatCurrency(m.profitPerOrder),
    "× Delivered orders": m.totalOrdersDelivered.toLocaleString(),
    "= Total profit": formatCurrency(m.totalProfit),
  };

  return (
    <div className="space-y-4">
      {canViewExpenses && !hasAdSpend && m.totalOrdersGenerated > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            No ad spend recorded for this period. CPA and ROAS are hidden;
            profit metrics still reflect delivered order economics.
          </p>
        </div>
      )}

      <div className={KPI_GRID_CLASS}>
        <KPICard
          title="Total Products"
          value={orgCounts.totalProducts.toString()}
          icon={ShoppingBag}
          color="blue"
        />
        <KPICard
          title="Total Agents"
          value={orgCounts.totalAgents.toString()}
          icon={UserCircle2}
          color="indigo"
        />
        <KPICard
          title="Orders Generated"
          value={m.totalOrdersGenerated.toLocaleString()}
          icon={ShoppingCart}
          color="teal"
          onExplain={openExplainer("orders_generated")}
        />
        <KPICard
          title="Orders Delivered"
          value={m.totalOrdersDelivered.toLocaleString()}
          subtitle={
            m.totalOrdersGenerated > 0
              ? `${m.totalOrdersDelivered} of ${m.totalOrdersGenerated}`
              : undefined
          }
          icon={Truck}
          color="green"
          onExplain={openExplainer("orders_delivered")}
        />
        <KPICard
          title="Delivery Rate"
          value={`${m.deliveryRate.toFixed(1)}%`}
          icon={Percent}
          color="blue"
          healthBand={rateBand}
          valueClassName={healthTextClass(rateBand)}
          onExplain={openExplainer("delivery_rate")}
        />

        {canViewExpenses && (
          <>
            <KPICard
              title="Average Order Value"
              value={formatCurrency(m.averageOrderValue)}
              subtitle="Delivered orders only"
              icon={DollarSign}
              color="indigo"
              onExplain={openExplainer("average_order_value")}
            />

            {hasAdSpend && (
              <>
                <KPICard
                  title="Platform CPA"
                  value={formatCurrency(m.platformCpa)}
                  subtitle="Ad spend ÷ generated"
                  icon={Target}
                  color="purple"
                  onExplain={openExplainer("platform_cpa")}
                />
                <KPICard
                  title="Real CPA"
                  value={formatCurrency(m.realCpa)}
                  subtitle={
                    m.cpaGap > 0
                      ? `Gap: ${formatCurrency(m.cpaGap)} vs platform`
                      : "Ad spend ÷ delivered"
                  }
                  icon={Target}
                  color="red"
                  healthBand={cpaHealth}
                  valueClassName={
                    cpaHealth ? healthTextClass(cpaHealth) : undefined
                  }
                  onExplain={openExplainer("real_cpa")}
                />
              </>
            )}

            <KPICard
              title="Average COGS"
              value={formatCurrency(m.averageCogs)}
              subtitle="Per delivered order"
              icon={Package}
              color="amber"
              onExplain={openExplainer("average_cogs")}
            />
            <KPICard
              title="Avg Delivery Fee"
              value={formatCurrency(m.averageDeliveryFee)}
              subtitle="Per delivered order"
              icon={Truck}
              color="amber"
              onExplain={openExplainer("average_delivery_fee")}
            />
            <KPICard
              title="Profit Per Order"
              value={formatCurrency(m.profitPerOrder)}
              subtitle="AOV − Real CPA − COGS − delivery"
              icon={TrendingUp}
              color="green"
              healthBand={profitHealth}
              valueClassName={healthTextClass(profitHealth)}
              onExplain={openExplainer("profit_per_order")}
            />
            <KPICard
              title="Total Profit (Delivered)"
              value={formatCurrency(m.totalProfit)}
              icon={TrendingUp}
              color="green"
              healthBand={profitHealth}
              valueClassName={healthTextClass(profitHealth)}
              onExplain={openExplainer("total_profit")}
            />

            {hasAdSpend && (
              <KPICard
                title="ROAS"
                value={formatRatio(m.roas)}
                subtitle="Delivered revenue ÷ ad spend"
                icon={BarChart3}
                color="blue"
                healthBand={roasHealth}
                valueClassName={
                  roasHealth ? healthTextClass(roasHealth) : undefined
                }
                onExplain={openExplainer("roas")}
              />
            )}

            {isBusinessView && (
              <KPICard
                title="Business ROI"
                value={formatRatio(m.businessRoi)}
                subtitle="Net after all expenses ÷ investment"
                icon={PieChart}
                color="indigo"
                healthBand={roiHealth}
                valueClassName={
                  roiHealth ? healthTextClass(roiHealth) : undefined
                }
                onExplain={openExplainer("business_roi")}
              />
            )}

            <KPICard
              title="Ad Spend"
              value={formatCurrency(m.adSpend)}
              icon={Scale}
              color="purple"
              onExplain={openExplainer("ad_spend")}
            />

            {isBusinessView && m.totalNonAdExpenses > 0 && (
              <KPICard
                title="Other Expenses"
                value={formatCurrency(m.totalNonAdExpenses)}
                subtitle="Non-ad operational costs in period"
                icon={Scale}
                color="amber"
                onExplain={openExplainer("other_expenses")}
              />
            )}
          </>
        )}
      </div>

      <MetricExplainerDialog
        explainerKey={explainerKey}
        open={explainerKey != null}
        onOpenChange={(open) => !open && setExplainerKey(null)}
        liveValues={profitWaterfallValues}
      />
    </div>
  );
}
