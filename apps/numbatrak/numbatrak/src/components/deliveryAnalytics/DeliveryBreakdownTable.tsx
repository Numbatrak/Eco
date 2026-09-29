import { useEffect, useState } from "react";
import { formatNaira } from "../../utils/currency";
import { LoadingState } from "../ui/LoadingState";
import {
  DeliveryAnalyticsFilters,
  DeliveryBreakdownRow,
  fetchDeliveryBreakdownByProduct,
} from "../../services/deliveryAnalytics";
import { useOrganization } from "../../contexts/OrganizationContext";

interface DeliveryBreakdownTableProps {
  filters: DeliveryAnalyticsFilters;
}

export function DeliveryBreakdownTable({ filters }: DeliveryBreakdownTableProps) {
  const { currentOrganization } = useOrganization();
  const [rows, setRows] = useState<DeliveryBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchDeliveryBreakdownByProduct(currentOrganization.id, filters);
        if (!cancel) setRows(data);
      } catch (e) {
        console.error(e);
        if (!cancel) setRows([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [currentOrganization?.id, filters]);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Product stock report</h2>
        <p className="text-sm text-muted-foreground">
          Waybilled vs delivered stock value and balance, by product.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingState label="Loading breakdown…" size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No delivery data for this filter combination.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Product
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Waybilled
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Delivered
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Balance
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNaira(row.waybilledValue, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNaira(row.deliveredValue, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatNaira(row.balance, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.deliveryRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Negative balance is normal when agents deliver stock waybilled before
        system go-live.
      </p>
    </section>
  );
}
