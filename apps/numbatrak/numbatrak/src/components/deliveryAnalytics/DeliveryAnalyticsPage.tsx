import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { PageLayout } from "../layout/PageLayout";
import { usePermissions } from "../../hooks/usePermissions";
import { DeliveryAnalyticsFiltersBar, DEFAULT_DELIVERY_ANALYTICS_FILTERS } from "./DeliveryAnalyticsFiltersBar";
import { DeliveryBreakdownTable, type DeliveryBreakdownGroupBy } from "./DeliveryBreakdownTable";
import { MonthlySummarySection } from "../deliveries/MonthlySummarySection";
import {
  DeliveryAnalyticsFilters,
  toMonthlySummaryQueryOptions,
} from "../../services/deliveryAnalytics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const GROUP_BY_OPTIONS: { value: DeliveryBreakdownGroupBy; label: string }[] = [
  { value: "product", label: "Product" },
  { value: "agent", label: "Agent" },
  { value: "csr", label: "CSR" },
];

/**
 * Delivery Analytics — deliberately just two things: the monthly summary and
 * the per-product waybilled/delivered stock report, both driven by the same
 * filter bar. Headline KPI cards, the location-rate cards, and the separate
 * waybill-by-state table were cut - they duplicated data already visible
 * here or on the Dashboard, without adding a distinct view.
 */
export function DeliveryAnalyticsPage() {
  const { hasAnyRole } = usePermissions();
  const [filters, setFilters] = useState<DeliveryAnalyticsFilters>(
    DEFAULT_DELIVERY_ANALYTICS_FILTERS
  );
  const [groupBy, setGroupBy] = useState<DeliveryBreakdownGroupBy>("product");

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
          Monthly summary and per-product waybilled vs delivered stock report —
          filterable by agent, location, product, sub-brand, and status.
        </p>
      </div>

      <DeliveryAnalyticsFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
      />

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs font-medium text-muted-foreground">Group by</span>
        <Select
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as DeliveryBreakdownGroupBy)}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DeliveryBreakdownTable filters={filters} groupBy={groupBy} />

      <MonthlySummarySection
        embedded
        queryOptions={monthlyQueryOptions}
      />
    </PageLayout>
  );
}
