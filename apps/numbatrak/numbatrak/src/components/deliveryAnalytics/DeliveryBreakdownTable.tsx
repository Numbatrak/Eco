import { useEffect, useState } from "react";
import { formatNaira } from "../../utils/currency";
import { LoadingState } from "../ui/LoadingState";
import {
  DeliveryAnalyticsFilters,
  DeliveryBreakdownRow,
  fetchDeliveryBreakdownByAgent,
  fetchDeliveryBreakdownByLocation,
  fetchDeliveryBreakdownByProduct,
} from "../../services/deliveryAnalytics";
import { useOrganization } from "../../contexts/OrganizationContext";

type BreakdownTab = "agent" | "location" | "product";

const TAB_LABELS: Record<BreakdownTab, string> = {
  agent: "By agent",
  location: "By location",
  product: "By product",
};

interface DeliveryBreakdownTableProps {
  filters: DeliveryAnalyticsFilters;
}

export function DeliveryBreakdownTable({ filters }: DeliveryBreakdownTableProps) {
  const { currentOrganization } = useOrganization();
  const [tab, setTab] = useState<BreakdownTab>("agent");
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
        const fetchers = {
          agent: fetchDeliveryBreakdownByAgent,
          location: fetchDeliveryBreakdownByLocation,
          product: fetchDeliveryBreakdownByProduct,
        };
        const data = await fetchers[tab](currentOrganization.id, filters);
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
  }, [currentOrganization?.id, filters, tab]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Breakdown</h2>
          <p className="text-sm text-muted-foreground">
            Waybilled vs delivered value and balance by segment.
          </p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
          {(Object.keys(TAB_LABELS) as BreakdownTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>
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
                    {TAB_LABELS[tab].replace("By ", "")}
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
