import { useEffect, useState } from "react";
import { KPICard } from "../KPICard";
import {
  fetchDeliveryAnalyticsHeadline,
  DeliveryAnalyticsHeadline,
  DeliveryAnalyticsFilters,
} from "../../services/deliveryAnalytics";
import { useOrganization } from "../../contexts/OrganizationContext";
import { formatNaira } from "../../utils/currency";
import { Package, Truck, Scale, TrendingUp } from "lucide-react";

const EMPTY_HEADLINE: DeliveryAnalyticsHeadline = {
  waybilledValue: 0,
  deliveredValue: 0,
  balance: 0,
  deliveryRate: 0,
  waybilledCount: 0,
  deliveredCount: 0,
};

interface DeliveryAnalyticsOverviewCardsProps {
  filters: DeliveryAnalyticsFilters;
}

export function DeliveryAnalyticsOverviewCards({
  filters,
}: DeliveryAnalyticsOverviewCardsProps) {
  const { currentOrganization } = useOrganization();
  const [headline, setHeadline] = useState<DeliveryAnalyticsHeadline>(
    EMPTY_HEADLINE
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setHeadline(EMPTY_HEADLINE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchDeliveryAnalyticsHeadline(
          currentOrganization.id,
          filters
        );
        if (!cancelled) setHeadline(data);
      } catch (e) {
        console.error("Delivery analytics headline:", e);
        if (!cancelled) setHeadline(EMPTY_HEADLINE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, filters]);

  const ph = loading ? "…" : formatNaira(0, { decimals: 0 });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KPICard
        title="Waybilled value"
        value={
          loading ? ph : formatNaira(headline.waybilledValue, { decimals: 0 })
        }
        subtitle={`${headline.waybilledCount.toLocaleString()} waybill line(s)`}
        icon={Package}
        color="blue"
      />
      <KPICard
        title="Delivered value"
        value={
          loading ? ph : formatNaira(headline.deliveredValue, { decimals: 0 })
        }
        subtitle={`${headline.deliveredCount.toLocaleString()} delivered line(s)`}
        icon={Truck}
        color="green"
      />
      <KPICard
        title="Balance"
        value={loading ? ph : formatNaira(headline.balance, { decimals: 0 })}
        subtitle="Waybilled − delivered (stock in motion)"
        icon={Scale}
        color="purple"
      />
      <KPICard
        title="Delivery rate"
        value={loading ? ph : `${headline.deliveryRate.toFixed(1)}%`}
        subtitle="Delivered ÷ total logistics lines"
        icon={TrendingUp}
        color="teal"
      />
    </div>
  );
}
