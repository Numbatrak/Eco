import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { DashboardSummary } from "./DashboardSummary";
import { LatestDeliveries } from "./LatestDeliveries";
import { RouteErrorBoundary } from "../RouteErrorBoundary";
import { DeliveryRateByLocationComponent } from "./DeliveryRateByLocation";
import { NewOrders } from "./NewOrders";
import { AbandonedCarts } from "./AbandonedCarts";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "./DashboardFilters";
import { LossPanel } from "./LossPanel";
import { DashboardAlertsBanner } from "./DashboardAlertsBanner";
import { useDashboardAlertsContext } from "../../contexts/DashboardAlertsContext";
import {
  fetchBusinessPerformanceMetrics,
  type BusinessPerformanceMetrics,
} from "../../services/dashboardMetrics";
import { computeDashboardAlerts, type DashboardAlert } from "../../services/dashboardAlerts";
import { loadDashboardAlertThresholds } from "../../services/dashboardAlertSettings";
import { usePermissions } from "../../hooks/usePermissions";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useAuth } from "../../auth/AuthProvider";
import { fetchCustomerRelationsUsers } from "../../services/customerRelations";
import { fetchAgents } from "../../services/agents";
import {
  fetchDashboardFilterOptions,
  fetchLossMetrics,
  LossMetrics,
  EMPTY_LOSS_METRICS,
  type DashboardMetricsScope,
} from "../../services/dashboardMetrics";
import { Form } from "../../types/form";
import { UserProfile } from "../../types/user";
import { Agent } from "../../services/agents";
import { PageLayout } from "../layout/PageLayout";
import { csrScopeFilter } from "../../utils/specRoles";
import { resolveDateRange, type DateFilterType } from "../../utils/dateRange";

// Activities isn't ported off Supabase yet - lazy + its own error boundary
// so a load failure only takes out this one widget, not the whole
// already-rendered Dashboard page (unlike the route-level RouteErrorBoundary,
// which would blank everything above it too).
const ActivityFeed = lazy(() => import("../ActivityFeed").then((m) => ({ default: m.ActivityFeed })));

export function DashboardPage() {
  const { hasAnyRole, hasRole, userRole } = usePermissions();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const canViewAnalytics = hasAnyRole(["Manager", "Admin", "Owner"]);
  const isCustomerRelations = hasRole("Customer Relations");

  const { setDashboardAlertContext } = useDashboardAlertsContext();

  const scopedCsrId = useMemo(
    () => csrScopeFilter(userRole, user?.id),
    [userRole, user?.id]
  );

  const [filterValues, setFilterValues] = useState<DashboardFilterValues>({
    dateFilter: { type: "all" },
    formId: null,
    csrId: null,
    funnelName: null,
    subBrand: null,
    agentId: null,
    status: null,
    viewMode: "business",
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [forms, setForms] = useState<Form[]>([]);
  const [csrUsers, setCsrUsers] = useState<UserProfile[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [funnelNames, setFunnelNames] = useState<string[]>([]);
  const [subBrands, setSubBrands] = useState<string[]>([]);
  const [lossMetrics, setLossMetrics] = useState<LossMetrics | null>(null);
  const [lossLoading, setLossLoading] = useState(false);
  const [dashboardAlerts, setDashboardAlerts] = useState<DashboardAlert[]>([]);
  const [performanceMetrics, setPerformanceMetrics] =
    useState<BusinessPerformanceMetrics | null>(null);

  const effectiveCsrId = scopedCsrId ?? filterValues.csrId;

  const metricsScope = useMemo<DashboardMetricsScope>(
    () => ({
      formId: filterValues.formId,
      csrId: effectiveCsrId,
      funnelName: filterValues.funnelName,
      subBrand: filterValues.subBrand,
      agentId: filterValues.agentId,
      status: filterValues.status,
    }),
    [
      filterValues.formId,
      effectiveCsrId,
      filterValues.funnelName,
      filterValues.subBrand,
      filterValues.agentId,
      filterValues.status,
    ]
  );

  useEffect(() => {
    setFilterValues((prev) => ({
      ...prev,
      formId: null,
      csrId: null,
      funnelName: null,
      subBrand: null,
      agentId: null,
      status: null,
    }));
    if (!currentOrganization) {
      setForms([]);
      setAgents([]);
      setFunnelNames([]);
      setSubBrands([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Forms isn't ported off Supabase yet - dynamic import + its own
      // try/catch so a module-load failure there only empties the forms
      // filter dropdown instead of blocking agents/funnel/sub-brand options
      // (which are already-ported) from loading too.
      try {
        const { fetchForms } = await import("../../services/forms");
        const formList = await fetchForms(currentOrganization.id);
        if (!cancelled) setForms(formList);
      } catch (e) {
        console.error("Error loading dashboard forms:", e);
        if (!cancelled) setForms([]);
      }

      try {
        const [agentList, attrOptions] = await Promise.all([
          fetchAgents(currentOrganization.id, { activeOnly: true }),
          fetchDashboardFilterOptions(currentOrganization.id),
        ]);
        if (!cancelled) {
          setAgents(agentList);
          setFunnelNames(attrOptions.funnelNames);
          setSubBrands(attrOptions.subBrands);
        }
      } catch (e) {
        console.error("Error loading dashboard filter data:", e);
        if (!cancelled) {
          setAgents([]);
          setFunnelNames([]);
          setSubBrands([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!currentOrganization) {
          if (!cancelled) setCsrUsers([]);
          return;
        }
        const users = await fetchCustomerRelationsUsers(currentOrganization.id);
        if (!cancelled) setCsrUsers(users);
      } catch {
        if (!cancelled) setCsrUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  useEffect(() => {
    setDashboardAlertContext({
      dateFilter: filterValues.dateFilter,
      scope: metricsScope,
      viewMode: filterValues.viewMode,
    });
  }, [
    filterValues.dateFilter,
    filterValues.viewMode,
    metricsScope,
    setDashboardAlertContext,
  ]);

  useEffect(() => {
    if (!currentOrganization || !canViewAnalytics) {
      setLossMetrics(null);
      setDashboardAlerts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLossLoading(true);
        const { startDate, endDate } = resolveDateRange(filterValues.dateFilter);
        const loss = await fetchLossMetrics(
          currentOrganization.id,
          startDate,
          endDate,
          metricsScope
        );
        if (!cancelled) setLossMetrics(loss);
      } catch (e) {
        console.error("Error loading loss metrics:", e);
        if (!cancelled) setLossMetrics(EMPTY_LOSS_METRICS);
      } finally {
        if (!cancelled) setLossLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization, canViewAnalytics, filterValues.dateFilter, metricsScope]);

  useEffect(() => {
    if (!currentOrganization || !canViewAnalytics || !performanceMetrics) {
      if (!canViewAnalytics) setDashboardAlerts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const thresholds = loadDashboardAlertThresholds(currentOrganization.id);
      const priorMetrics = await fetchPriorPeriodMetrics(
        currentOrganization.id,
        filterValues.dateFilter,
        metricsScope
      );
      if (!cancelled) {
        setDashboardAlerts(
          computeDashboardAlerts({
            metrics: performanceMetrics,
            loss: lossMetrics,
            thresholds,
            priorMetrics,
            includeBusinessRoi: filterValues.viewMode === "business",
          })
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentOrganization,
    canViewAnalytics,
    performanceMetrics,
    lossMetrics,
    filterValues.dateFilter,
    filterValues.viewMode,
    metricsScope,
  ]);

  const handleDateFilterChange = (type: DateFilterType) => {
    if (type === "custom") {
      setFilterValues((prev) => ({
        ...prev,
        dateFilter: {
          type: "custom",
          startDate: customStartDate,
          endDate: customEndDate,
        },
      }));
    } else {
      setFilterValues((prev) => ({ ...prev, dateFilter: { type } }));
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setFilterValues((prev) => ({
        ...prev,
        dateFilter: {
          type: "custom",
          startDate: customStartDate,
          endDate: customEndDate,
        },
      }));
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {currentOrganization
            ? `Dashboard - ${currentOrganization.name}`
            : "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your organisation&apos;s performance
        </p>
      </div>

      <DashboardFilters
        values={filterValues}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomStartDateChange={setCustomStartDate}
        onCustomEndDateChange={setCustomEndDate}
        onDateFilterChange={handleDateFilterChange}
        onCustomDateApply={handleCustomDateApply}
        onFormChange={(formId) =>
          setFilterValues((prev) => ({ ...prev, formId }))
        }
        onCsrChange={(csrId) =>
          setFilterValues((prev) => ({ ...prev, csrId }))
        }
        onFunnelChange={(funnelName) =>
          setFilterValues((prev) => ({ ...prev, funnelName }))
        }
        onSubBrandChange={(subBrand) =>
          setFilterValues((prev) => ({ ...prev, subBrand }))
        }
        onAgentChange={(agentId) =>
          setFilterValues((prev) => ({ ...prev, agentId }))
        }
        onStatusChange={(status) =>
          setFilterValues((prev) => ({ ...prev, status }))
        }
        onViewModeChange={(viewMode) =>
          setFilterValues((prev) => ({ ...prev, viewMode }))
        }
        forms={forms}
        csrUsers={csrUsers}
        agents={agents}
        funnelNames={funnelNames}
        subBrands={subBrands}
        showCsrFilter={!scopedCsrId}
        showExtendedFilters={canViewAnalytics}
        showViewToggle={canViewAnalytics}
      />

      {canViewAnalytics && dashboardAlerts.length > 0 && (
        <DashboardAlertsBanner alerts={dashboardAlerts} />
      )}

      <section>
        <DashboardSummary
          dateFilter={filterValues.dateFilter}
          scope={metricsScope}
          viewMode={filterValues.viewMode}
          onMetricsLoaded={setPerformanceMetrics}
        />
      </section>

      {canViewAnalytics && filterValues.viewMode === "business" && (
        <section>
          <LossPanel
            metrics={lossMetrics}
            loading={lossLoading}
            formatCurrency={formatCurrency}
          />
        </section>
      )}

      {canViewAnalytics && (
        <section>
          <DeliveryRateByLocationComponent dateFilter={filterValues.dateFilter} />
        </section>
      )}

      <section>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          {isCustomerRelations ? (
            <>
              <NewOrders
                formId={filterValues.formId}
                csrId={effectiveCsrId}
              />
              <AbandonedCarts formId={filterValues.formId} />
            </>
          ) : (
            <>
              <LatestDeliveries />
              <RouteErrorBoundary>
                <Suspense fallback={null}>
                  <ActivityFeed />
                </Suspense>
              </RouteErrorBoundary>
            </>
          )}
        </div>
      </section>
    </PageLayout>
  );
}

async function fetchPriorPeriodMetrics(
  organizationId: string,
  dateFilter: DashboardFilterValues["dateFilter"],
  scope: DashboardMetricsScope
) {
  const { startDate, endDate } = resolveDateRange(dateFilter);
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return null;

  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - durationMs);

  return fetchBusinessPerformanceMetrics(
    organizationId,
    priorStart.toISOString(),
    priorEnd.toISOString(),
    scope
  );
}
