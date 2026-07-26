import { useMemo } from "react";
import { AgentStockOnHandRow } from "../../types/stockMovement";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { buildOnHandMap } from "../../services/agentStock";
import { LoadingState } from "../ui/LoadingState";

interface StockGridProps {
  onHandRows: AgentStockOnHandRow[];
  agents: Agent[];
  products: Product[];
  loading?: boolean;
  filterAgentId?: number | null;
  filterProductId?: string | null;
}

export function StockGrid({
  onHandRows,
  agents,
  products,
  loading,
  filterAgentId,
  filterProductId,
}: StockGridProps) {
  const holderAgents = useMemo(() => {
    const list = agents
      .filter((a) => a.active !== false)
      .sort((a, b) => {
        if (a.is_warehouse && !b.is_warehouse) return -1;
        if (!a.is_warehouse && b.is_warehouse) return 1;
        return a.name.localeCompare(b.name);
      });
    if (filterAgentId != null) {
      return list.filter((a) => a.id === filterAgentId);
    }
    return list;
  }, [agents, filterAgentId]);

  const gridProducts = useMemo(() => {
    const list = products.filter((p) => p.active !== false);
    if (filterProductId) {
      return list.filter((p) => p.id === filterProductId);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filterProductId]);

  const onHandMap = useMemo(() => buildOnHandMap(onHandRows), [onHandRows]);

  const costByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.id, p.cost_price ?? 0);
    }
    return map;
  }, [products]);

  const { totalUnits, totalCostValue } = useMemo(() => {
    let units = 0;
    let cost = 0;
    for (const row of onHandRows) {
      if (filterAgentId != null && row.agent_id !== filterAgentId) continue;
      if (filterProductId && row.product_id !== filterProductId) continue;
      if (row.quantity_on_hand <= 0) continue;
      units += row.quantity_on_hand;
      cost += row.quantity_on_hand * (costByProduct.get(row.product_id) ?? 0);
    }
    return { totalUnits: units, totalCostValue: cost };
  }, [onHandRows, filterAgentId, filterProductId, costByProduct]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingState label="Loading stock grid…" size="sm" className="py-4" />
      </div>
    );
  }

  if (!holderAgents.length || !gridProducts.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        Add agents and products, then record waybills or movements to populate the
        stock grid.
      </div>
    );
  }

  const getQty = (agentId: number, productId: string) =>
    onHandMap.get(agentId)?.get(productId) ?? 0;

  const isLowStock = (agentId: number, productId: string, qty: number) => {
    const threshold = products.find((p) => p.id === productId)?.low_stock_threshold;
    if (threshold == null || threshold <= 0) return false;
    return qty <= threshold;
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
            {gridProducts.map((product) => (
              <tr
                key={product.id}
                className="border-b border-border/80 hover:bg-muted/20"
              >
                <td className="p-3 font-medium text-foreground sticky left-0 bg-card z-[1]">
                  {product.name}
                </td>
                {holderAgents.map((agent) => {
                  const qty = getQty(agent.id, product.id);
                  const low = isLowStock(agent.id, product.id, qty);
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
                      title={
                        low
                          ? `Low stock (threshold: ${product.low_stock_threshold})`
                          : undefined
                      }
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
                      {totalCostValue.toLocaleString("en-NG", {
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
