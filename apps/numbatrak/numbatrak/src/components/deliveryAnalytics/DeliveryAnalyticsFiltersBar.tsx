import { useEffect, useState } from "react";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { WalletDateFilterBar } from "../wallet/WalletDateFilterBar";
import { DateFilter } from "../../utils/dateRange";
import {
  DeliveryAnalyticsFilters,
  DeliveryLocationFilter,
} from "../../services/deliveryAnalytics";
import { fetchAgents } from "../../services/agents";
import { fetchProducts } from "../../services/products";
import { fetchDashboardFilterOptions } from "../../services/dashboardMetrics";
import { useOrganization } from "../../contexts/OrganizationContext";
import type { Agent } from "../../types/agent";
import type { Product } from "../../types/product";

export const DEFAULT_DELIVERY_ANALYTICS_FILTERS: DeliveryAnalyticsFilters = {
  dateFilter: { type: "this_month" },
  agentId: null,
  productId: null,
  status: "all",
  subBrand: null,
  location: "all",
};

interface DeliveryAnalyticsFiltersBarProps {
  filters: DeliveryAnalyticsFilters;
  onFiltersChange: (filters: DeliveryAnalyticsFilters) => void;
}

export function DeliveryAnalyticsFiltersBar({
  filters,
  onFiltersChange,
}: DeliveryAnalyticsFiltersBarProps) {
  const { currentOrganization } = useOrganization();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [subBrands, setSubBrands] = useState<string[]>([]);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setAgents([]);
      setProducts([]);
      setSubBrands([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const [a, p, opts] = await Promise.all([
          fetchAgents(currentOrganization.id),
          fetchProducts(currentOrganization.id),
          fetchDashboardFilterOptions(currentOrganization.id),
        ]);
        if (!cancel) {
          setAgents(a);
          setProducts(p);
          setSubBrands(opts.subBrands);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [currentOrganization?.id]);

  const patch = (partial: Partial<DeliveryAnalyticsFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Filters</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          All metrics on this page recalculate when filters change.
        </p>
      </div>

      <WalletDateFilterBar
        dateFilter={filters.dateFilter ?? { type: "this_month" }}
        onDateFilterChange={(dateFilter: DateFilter) => patch({ dateFilter })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Agent</Label>
          <Select
            value={filters.agentId != null ? String(filters.agentId) : "all"}
            onValueChange={(v) =>
              patch({ agentId: v === "all" ? null : parseInt(v, 10) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <Select
            value={filters.productId ?? "all"}
            onValueChange={(v) =>
              patch({ productId: v === "all" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) =>
              patch({
                status:
                  v === "Waybilled" || v === "Delivered" ? v : "all",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Waybilled">Waybilled</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <Select
            value={filters.location ?? "all"}
            onValueChange={(v) =>
              patch({ location: v as DeliveryLocationFilter })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="lagos">Lagos</SelectItem>
              <SelectItem value="outside_lagos">Outside Lagos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {subBrands.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sub-brand</Label>
            <Select
              value={filters.subBrand ?? "all"}
              onValueChange={(v) =>
                patch({ subBrand: v === "all" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All sub-brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sub-brands</SelectItem>
                {subBrands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
