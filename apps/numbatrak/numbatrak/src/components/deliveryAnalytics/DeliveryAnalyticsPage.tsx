import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { PageLayout } from "../layout/PageLayout";
import { usePermissions } from "../../hooks/usePermissions";
import { DeliveryAnalyticsOverviewCards } from "./DeliveryAnalyticsOverviewCards";
import { DeliveryAnalyticsFiltersBar, DEFAULT_DELIVERY_ANALYTICS_FILTERS } from "./DeliveryAnalyticsFiltersBar";
import { DeliveryBreakdownTable } from "./DeliveryBreakdownTable";
import { DeliveryRateByLocationComponent } from "../dashboard/DeliveryRateByLocation";
import { WaybillStatisticsTable } from "../waybillStatistics/WaybillStatisticsTable";
import { MonthlySummarySection } from "../deliveries/MonthlySummarySection";
import {
  DeliveryAnalyticsFilters,
  toMonthlySummaryQueryOptions,
} from "../../services/deliveryAnalytics";

/**
 * Delivery Analytics — waybill roll-up + delivery performance (spec §7).
 * Unified filters recalculate headline KPIs, location cards, breakdown, and monthly table.
 */
export function DeliveryAnalyticsPage() {
  const { hasAnyRole } = usePermissions();
  const [filters, setFilters] = useState<DeliveryAnalyticsFilters>(
    DEFAULT_DELIVERY_ANALYTICS_FILTERS
  );

  const monthlyQueryOptions = useMemo(
    () => toMonthlySummaryQueryOptions(filters),
    [filters]
  );

  if (!hasAnyRole(["Manager", "Admin", "Owner"])) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageLayout>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Delivery Analytics
        </h1>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Waybilled vs delivered stock value, balance roll-up, and delivery rate —
          filterable by agent, location, product, sub-brand, and status.
        </p>
      </div>

      <DeliveryAnalyticsFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
      />

      <section className="space-y-3" aria-labelledby="delivery-overview-heading">
        <h2 id="delivery-overview-heading" className="text-lg font-semibold text-foreground">
          Headline metrics
        </h2>
        <DeliveryAnalyticsOverviewCards filters={filters} />
      </section>

      <section aria-labelledby="delivery-rate-heading">
        <DeliveryRateByLocationComponent
          embedded
          analyticsFilters={filters}
        />
      </section>

      <DeliveryBreakdownTable filters={filters} />

      <section className="space-y-4" aria-labelledby="waybill-by-state-heading">
        <div className="space-y-1">
          <h2 id="waybill-by-state-heading" className="text-lg font-semibold text-foreground">
            Waybill statistics by state
          </h2>
          <p className="text-muted-foreground text-sm">
            Inventory waybilled from HQ to agents — quantities, costs, and movement speed.
          </p>
        </div>
        <WaybillStatisticsTable />
      </section>

      <MonthlySummarySection
        embedded
        queryOptions={monthlyQueryOptions}
      />
    </PageLayout>
  );
}
