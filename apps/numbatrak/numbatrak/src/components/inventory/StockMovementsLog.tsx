import { useMemo } from "react";
import { StockMovement } from "../../types/stockMovement";
import { Agent } from "../../types/agent";
import { useClientPagination } from "../../hooks/useClientPagination";
import { TablePagination } from "../ui/TablePagination";
import { LoadingState } from "../ui/LoadingState";

const typeLabel: Record<string, string> = {
  waybill_to_agent: "Waybill → agent",
  deliver_to_customer: "Deliver to customer",
  return_to_lagos: "Return to Lagos",
  transfer: "Transfer",
  adjust: "Adjust",
  damaged: "Damaged",
  missing: "Missing",
};

interface StockMovementsLogProps {
  movements: StockMovement[];
  loading?: boolean;
  agents?: Agent[];
}

function resolveAgentName(
  agentId: number | null,
  agentNames: Map<number, string>,
  isWarehouse?: boolean
): string {
  if (agentId == null) return "External / HQ";
  const name = agentNames.get(agentId);
  if (name) return isWarehouse ? `${name} (Warehouse)` : name;
  return `Agent #${agentId}`;
}

export function StockMovementsLog({
  movements,
  loading,
  agents = [],
}: StockMovementsLogProps) {
  const agentMeta = useMemo(() => {
    const names = new Map<number, string>();
    const warehouse = new Set<number>();
    for (const agent of agents) {
      names.set(agent.id, agent.name);
      if (agent.is_warehouse) warehouse.add(agent.id);
    }
    return { names, warehouse };
  }, [agents]);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
  } = useClientPagination(movements, 25);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingState label="Loading movements…" size="sm" className="py-4" />
      </div>
    );
  }
  if (!movements.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No stock movements match the current filters.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b border-border">
            <tr className="text-left">
              <th className="p-2.5 font-medium text-foreground">When</th>
              <th className="p-2.5 font-medium text-foreground">Type</th>
              <th className="p-2.5 font-medium text-foreground">Qty</th>
              <th className="p-2.5 font-medium text-foreground">From</th>
              <th className="p-2.5 font-medium text-foreground">To</th>
              <th className="p-2.5 font-medium text-foreground">Reason / notes</th>
              <th className="p-2.5 font-medium text-right text-foreground">
                Cost
              </th>
              <th className="p-2.5 font-medium text-right text-foreground">
                Fee
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border/60 hover:bg-accent/50"
              >
                <td className="p-2.5 whitespace-nowrap text-muted-foreground">
                  {new Date(m.occurred_at).toLocaleString()}
                </td>
                <td className="p-2.5 text-foreground">
                  {typeLabel[m.movement_type] || m.movement_type}
                </td>
                <td className="p-2.5 tabular-nums text-foreground">
                  {m.quantity}
                </td>
                <td className="p-2.5 text-foreground">
                  {m.from_agent_id != null
                    ? resolveAgentName(
                        m.from_agent_id,
                        agentMeta.names,
                        agentMeta.warehouse.has(m.from_agent_id)
                      )
                    : "External / HQ"}
                </td>
                <td className="p-2.5 text-foreground">
                  {resolveAgentName(
                    m.to_agent_id,
                    agentMeta.names,
                    m.to_agent_id != null &&
                      agentMeta.warehouse.has(m.to_agent_id)
                  )}
                </td>
                <td
                  className="p-2.5 text-muted-foreground max-w-[200px] truncate"
                  title={m.notes ?? undefined}
                >
                  {m.notes || "—"}
                </td>
                <td className="p-2.5 text-right tabular-nums text-foreground">
                  {Number(m.cost).toLocaleString("en-NG", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="p-2.5 text-right tabular-nums text-foreground">
                  {Number(m.fee).toLocaleString("en-NG", {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
