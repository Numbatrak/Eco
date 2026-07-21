import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { DateInput } from "../ui/date-input";
import { Label } from "../ui/label";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { StockMovementType } from "../../types/stockMovement";

export type InventoryLedgerFilters = {
  agent_id?: number;
  product_id?: string;
  movement_type?: StockMovementType;
  date_from?: string;
  date_to?: string;
};

interface InventoryFiltersProps {
  agents: Agent[];
  products: Product[];
  filters: InventoryLedgerFilters;
  onChange: (filters: InventoryLedgerFilters) => void;
}

const MOVEMENT_TYPES: { value: StockMovementType; label: string }[] = [
  { value: "waybill_to_agent", label: "Waybill → agent" },
  { value: "deliver_to_customer", label: "Deliver to customer" },
  { value: "transfer", label: "Transfer" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
  { value: "return_to_lagos", label: "Return to Lagos" },
  { value: "adjust", label: "Adjust" },
];

export function InventoryFilters({
  agents,
  products,
  filters,
  onChange,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-border bg-muted/20">
      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">Agent</Label>
        <Select
          value={filters.agent_id != null ? String(filters.agent_id) : "all"}
          onValueChange={(v) =>
            onChange({
              ...filters,
              agent_id: v === "all" ? undefined : Number(v),
            })
          }
        >
          <SelectTrigger className="bg-background">
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

      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">Product</Label>
        <Select
          value={filters.product_id ?? "all"}
          onValueChange={(v) =>
            onChange({
              ...filters,
              product_id: v === "all" ? undefined : v,
            })
          }
        >
          <SelectTrigger className="bg-background">
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

      <div className="space-y-1.5 min-w-[160px]">
        <Label className="text-xs text-muted-foreground">Movement type</Label>
        <Select
          value={filters.movement_type ?? "all"}
          onValueChange={(v) =>
            onChange({
              ...filters,
              movement_type:
                v === "all" ? undefined : (v as StockMovementType),
            })
          }
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {MOVEMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <DateInput
          value={filters.date_from ?? ""}
          onChange={(v) =>
            onChange({ ...filters, date_from: v || undefined })
          }
          className="bg-background w-[140px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <DateInput
          value={filters.date_to ?? ""}
          onChange={(v) =>
            onChange({ ...filters, date_to: v || undefined })
          }
          className="bg-background w-[140px]"
        />
      </div>
    </div>
  );
}
