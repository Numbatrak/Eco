import { useMemo } from "react";
import { AgentStockOnHandRow } from "../../types/stockMovement";
import { Agent } from "../../types/agent";
import { ProductWithDetails } from "../../types/product";
import { buildOnHandMap, onHandKey } from "../../services/agentStock";
import { LoadingState } from "../ui/LoadingState";

interface GridRow {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  lowStockThreshold: number | null | undefined;
  subBrand: string | null | undefined;
}

interface StockGridProps {
  onHandRows: AgentStockOnHandRow[];
  agents: Agent[];
  products: ProductWithDetails[];
  loading?: boolean;
  filterAgentId?: number | null;
  filterProductId?: string | null;
  filterSubBrand?: string | null;
  filterLocation?: string | null;
  /** Server-computed: every agent's holdings x cost price, summed org-wide. */
  costOfInventory: number;
  /** Org-wide fallback (organizations/InventorySettings.tsx) used when a
   * product's own low_stock_threshold is null. */
  defaultLowStockThreshold?: number;
}

export function StockGrid({
  onHandRows,
  agents,
  products,
  loading,
  filterAgentId,
  filterProductId,
  filterSubBrand,
  filterLocation,
  costOfInventory,
  defaultLowStockThreshold,
}: StockGridProps) {
  const holderAgents = useMemo(() => {
    const list = agents
      .filter((a) => a.active !== false)
      .filter((a) => !filterLocation || a.locations.includes(filterLocation))
      .sort((a, b) => {
        if (a.is_warehouse && !b.is_warehouse) return -1;
        if (!a.is_warehouse && b.is_warehouse) return 1;
        return a.name.localeCompare(b.name);
      });
    if (filterAgentId != null) {
      return list.filter((a) => a.id === filterAgentId);
    }
    return list;
  }, [agents, filterAgentId, filterLocation]);

  // One row per (product, variant) - a product with variants gets one row
  // per active variant instead of a single generalized row, so each
  // variant's on-hand is tracked and shown independently.
  const gridRows = useMemo(() => {
    const filteredProducts = products
      .filter((p) => p.active !== false)
      .filter((p) => !filterSubBrand || p.sub_brand === filterSubBrand)
      .filter((p) => !filterProductId || p.id === filterProductId);

    const rows: GridRow[] = [];
    for (const product of filteredProducts) {
      const variants = product.allows_variants
        ? (product.variants ?? []).filter((v) => v.active !== false)
        : [];
      if (variants.length > 0) {
        for (const variant of variants) {
          rows.push({
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName: variant.name,
            lowStockThreshold: product.low_stock_threshold,
            subBrand: product.sub_brand,
          });
        }
      } else {
        rows.push({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantName: null,
          lowStockThreshold: product.low_stock_threshold,
          subBrand: product.sub_brand,
        });
      }
    }
    return rows.sort((a, b) => {
      const byProduct = a.productName.localeCompare(b.productName);
      if (byProduct !== 0) return byProduct;
      return (a.variantName ?? "").localeCompare(b.variantName ?? "");
    });
  }, [products, filterProductId, filterSubBrand]);

  const onHandMap = useMemo(() => buildOnHandMap(onHandRows), [onHandRows]);

  const totalUnits = useMemo(() => {
    let units = 0;
    for (const row of onHandRows) {
      if (filterAgentId != null && row.agent_id !== filterAgentId) continue;
      if (filterProductId && row.product_id !== filterProductId) continue;
      if (row.quantity_on_hand <= 0) continue;
      units += row.quantity_on_hand;
    }
    return units;
  }, [onHandRows, filterAgentId, filterProductId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingState label="Loading stock grid…" size="sm" className="py-4" />
      </div>
    );
  }

  if (!holderAgents.length || !gridRows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        Add agents and products, then record waybills or movements to populate the
        stock grid.
      </div>
    );
  }

  const getQty = (agentId: number, productId: string, variantId: string | null) =>
    onHandMap.get(agentId)?.get(onHandKey(productId, variantId)) ?? 0;

  const isLowStock = (threshold: number | null | undefined, qty: number) => {
    const effectiveThreshold = threshold ?? defaultLowStockThreshold;
    if (effectiveThreshold == null || effectiveThreshold <= 0) return false;
    return qty <= effectiveThreshold;
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium text-foreground sticky left-0 bg-muted/90 backdrop-blur z-10 min-w-[140px]">
                Product
              </th>
              {holderAgents.map((agent) => (
                <th
                  key={agent.id}
                  className="p-3 font-medium text-foreground text-center min-w-[88px]"
                  title={agent.is_warehouse ? "Warehouse — does not deliver" : undefined}
                >
                  <span className={agent.is_warehouse ? "text-primary" : ""}>
                    {agent.name}
                  </span>
                  {agent.is_warehouse && (
                    <span className="block text-[10px] font-normal text-muted-foreground uppercase tracking-wide">
                      Warehouse
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridRows.map((row) => (
              <tr
                key={`${row.productId}:${row.variantId ?? ""}`}
                className="border-b border-border/80 hover:bg-muted/20"
              >
                <td className="p-3 font-medium text-foreground sticky left-0 bg-card z-[1]">
                  {row.productName}
                  {row.variantName && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.variantName}
                    </span>
                  )}
                </td>
                {holderAgents.map((agent) => {
                  const qty = getQty(agent.id, row.productId, row.variantId);
                  const low = isLowStock(row.lowStockThreshold, qty);
                  return (
                    <td
                      key={agent.id}
                      className={`p-3 text-center tabular-nums ${
                        low
                          ? "bg-destructive/15 text-destructive font-semibold"
                          : qty > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                      }`}
                      title={low ? `Low stock (threshold: ${row.lowStockThreshold})` : undefined}
                    >
                      {qty > 0 ? qty : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td
                colSpan={holderAgents.length + 1}
                className="p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-muted-foreground">Total units on hand: </span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {totalUnits.toLocaleString("en-NG")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost of inventory: </span>
                    <span className="font-bold text-foreground tabular-nums">
                      ₦
                      {costOfInventory.toLocaleString("en-NG", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Red cells = at or below product low-stock threshold. Holdings from{" "}
        <code className="text-[11px]">stock_movements</code> ledger (includes
        transfers, damaged, missing).
      </p>
    </div>
  );
}
