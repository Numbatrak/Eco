import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  fetchDeliveryRateByLocation,
  DeliveryRateByLocation,
} from "../../services/dashboard";
import { MapPin, TrendingUp } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import { useOrganization } from "../../contexts/OrganizationContext";

interface LocationCardStyle {
  card: string;
  title: string;
  badge: string;
  bar: string;
}

function getLocationStyle(location: string): LocationCardStyle {
  if (location === "Overall") {
    return {
      card: "bg-primary/5 border-primary/20",
      title: "text-primary dark:text-primary/90",
      badge: "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary/90",
      bar: "bg-primary",
    };
  }
  if (location === "Lagos") {
    return {
      card: "bg-blue-500/5 border-blue-500/20",
      title: "text-blue-600 dark:text-blue-400",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      bar: "bg-blue-600 dark:bg-blue-500",
    };
  }
  return {
    card: "bg-purple-500/5 border-purple-500/20",
    title: "text-purple-600 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
    bar: "bg-purple-600 dark:bg-purple-500",
  };
}

import { DateFilter } from "../../utils/dateRange";
import type { DeliveryAnalyticsFilters } from "../../services/deliveryAnalytics";
import { fetchDeliveryRateByLocationFiltered } from "../../services/deliveryAnalytics";

interface DeliveryRateByLocationComponentProps {
  /** When true, parent page already enforced role access */
  embedded?: boolean;
  dateFilter?: DateFilter;
  /** Unified delivery analytics filters (preferred on Delivery Analytics page) */
  analyticsFilters?: DeliveryAnalyticsFilters;
}

export function DeliveryRateByLocationComponent({
  embedded = false,
  dateFilter,
  analyticsFilters,
}: DeliveryRateByLocationComponentProps) {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<DeliveryRateByLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasAnyRole } = usePermissions();

  const canViewAnalytics = hasAnyRole(["Manager", "Admin", "Owner"]);

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id, dateFilter, analyticsFilters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = analyticsFilters
        ? await fetchDeliveryRateByLocationFiltered(
            currentOrganization?.id ?? null,
            analyticsFilters
          )
        : await fetchDeliveryRateByLocation(
            currentOrganization?.id ?? null,
            dateFilter
          );
      setData(result);
    } catch (err) {
      console.error("Error loading delivery rate by location:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && !canViewAnalytics) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Rate by Location</CardTitle>
          <CardDescription>Lagos vs Outside Lagos delivery performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Delivery Rate by Location
        </CardTitle>
        <CardDescription>
          Overall delivery performance and comparison: Lagos vs Outside Lagos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((item) => {
            const style = getLocationStyle(item.location);
            return (
              <div
                key={item.location}
                className={`rounded-xl p-6 border ${style.card} transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-base font-semibold ${style.title}`}>
                    {item.location}
                  </h3>
                  <div
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${style.badge}`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    {item.deliveryRate}%
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Deliveries</span>
                    <span className="font-semibold text-foreground">
                      {item.totalDeliveries.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Delivered</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.deliveredCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Waybilled</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {item.waybilledCount.toLocaleString()}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Delivery Rate</span>
                      <span className="text-xs font-semibold text-foreground">
                        {item.deliveryRate}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${style.bar}`}
                        style={{ width: `${Math.min(item.deliveryRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
