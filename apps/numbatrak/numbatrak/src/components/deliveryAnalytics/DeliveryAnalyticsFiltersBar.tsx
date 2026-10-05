import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { RemittanceDateFilterBar } from "../remittance/RemittanceDateFilterBar";
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

const LOCATION_LABELS: Record<string, string> = {
  lagos: "Lagos",
  outside_lagos: "Outside Lagos",
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
  const [open, setOpen] = useState(false);

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
          fetchAgents(currentOrganization.id, { activeOnly: true }),
          fetchProducts(currentOrganization.id, { activeOnly: true }),
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

  const selectedAgent = agents.find((a) => a.id === filters.agentId);
  const selectedProduct = products.find((p) => p.id === filters.productId);

  const chips = useMemo(() => {
    const list: { key: string; label: string; onClear: () => void }[] = [];
    if (filters.agentId != null) {
      list.push({ key: "agent", label: selectedAgent?.name ?? "Agent", onClear: () => patch({ agentId: null }) });
    }
    if (filters.productId) {
      list.push({ key: "product", label: selectedProduct?.name ?? "Product", onClear: () => patch({ productId: null }) });
    }
    if (filters.status && filters.status !== "all") {
      list.push({ key: "status", label: filters.status, onClear: () => patch({ status: "all" }) });
    }
    if (filters.location && filters.location !== "all") {
      list.push({ key: "location", label: LOCATION_LABELS[filters.location] ?? filters.location, onClear: () => patch({ location: "all" }) });
    }
    if (filters.subBrand) {
      list.push({ key: "subBrand", label: filters.subBrand, onClear: () => patch({ subBrand: null }) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.agentId, filters.productId, filters.status, filters.location, filters.subBrand, selectedAgent, selectedProduct]);

  function clearAll() {
    patch({ agentId: null, productId: null, status: "all", location: "all", subBrand: null });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <RemittanceDateFilterBar
          dateFilter={filters.dateFilter ?? { type: "this_month" }}
          onDateFilterChange={(dateFilter: DateFilter) => patch({ dateFilter })}
        />

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {chips.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1.5">
                  {chips.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(92vw,22rem)] p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Agent</Label>
              <Select
                value={filters.agentId != null ? String(filters.agentId) : "all"}
                onValueChange={(v) => patch({ agentId: v === "all" ? null : parseInt(v, 10) })}
              >
                <SelectTrigger className="w-full">
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
              <Select value={filters.productId ?? "all"} onValueChange={(v) => patch({ productId: v === "all" ? null : v })}>
                <SelectTrigger className="w-full">
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
                    status: v === "Waybilled" || v === "PickedUp" || v === "Delivered" ? v : "all",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Waybilled">Waybilled</SelectItem>
                  <SelectItem value="PickedUp">Picked up</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Select value={filters.location ?? "all"} onValueChange={(v) => patch({ location: v as DeliveryLocationFilter })}>
                <SelectTrigger className="w-full">
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
                <Select value={filters.subBrand ?? "all"} onValueChange={(v) => patch({ subBrand: v === "all" ? null : v })}>
                  <SelectTrigger className="w-full">
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

            {chips.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="self-start -ml-2 text-muted-foreground">
                Clear all filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 font-normal">
              {chip.label}
              <button
                type="button"
                onClick={chip.onClear}
                aria-label={`Clear ${chip.label} filter`}
                className="rounded-sm hover:bg-foreground/10 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
