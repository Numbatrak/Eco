import { AgentStockBreakdownRow } from "../../types/stockMovement";
import { LoadingState } from "../ui/LoadingState";

interface AgentStockMatrixProps {
  rows: AgentStockBreakdownRow[];
  loading?: boolean;
}

export function AgentStockMatrix({ rows, loading }: AgentStockMatrixProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingState label="Loading stock breakdown…" size="sm" className="py-4" />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        No ledger movements yet. Record waybills from the Waybills page or run backfill
        migrations.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="p-3 font-medium text-foreground">Agent</th>
            <th className="p-3 font-medium text-foreground">Product</th>
            <th className="p-3 font-medium text-foreground text-right">Waybilled in</th>
            <th className="p-3 font-medium text-foreground text-right">Delivered out</th>
            <th className="p-3 font-medium text-foreground text-right">Approx. left</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.agent_id}-${r.product_id}`}
              className="border-b border-border/80 hover:bg-muted/20"
            >
              <td className="p-3 text-foreground">{r.agent_name}</td>
              <td className="p-3 text-foreground">{r.product_name}</td>
              <td className="p-3 text-right tabular-nums">{r.waybilled_in}</td>
              <td className="p-3 text-right tabular-nums">
                {r.delivered_to_customer}
              </td>
              <td className="p-3 text-right tabular-nums font-medium">
                {r.approx_remaining}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
