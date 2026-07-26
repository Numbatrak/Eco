import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, Truck, Wallet } from "lucide-react";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchAgentStockOnHand } from "../../services/agentStock";
import {
  fetchAgentMetrics,
  fetchAgentRemittanceHistory,
  formatDeliveryRate,
} from "../../services/agentMetrics";
import { listStockMovements } from "../../services/stockMovements";
import { fetchAgents } from "../../services/agents";
import { fetchProducts } from "../../services/products";
import { AgentStockOnHandRow } from "../../types/stockMovement";
import { StockMovement } from "../../types/stockMovement";
import { StockGrid } from "../inventory/StockGrid";
import { StockMovementsLog } from "../inventory/StockMovementsLog";
import { AgentRemittanceHistory } from "./AgentRemittanceHistory";
import { AgentContactCard } from "./AgentContactCard";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import type { AgentMetrics } from "../../services/agentMetrics";
import type { WalletRemittanceLine } from "../../types/wallet";

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = agentId ? parseInt(agentId, 10) : NaN;
  const { currentOrganization } = useOrganization();
  const { hasAnyRole } = usePermissions();
  const canViewWallet = hasAnyRole(["Manager", "Admin", "Owner"]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rows, setRows] = useState<AgentStockOnHandRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [remittanceLines, setRemittanceLines] = useState<WalletRemittanceLine[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization || Number.isNaN(id)) {
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const [aList, onHand, mv, productList, agentMetrics, remittance] =
          await Promise.all([
            fetchAgents(currentOrganization.id),
            fetchAgentStockOnHand(currentOrganization.id),
            listStockMovements(currentOrganization.id, {
              limit: 200,
              agent_id: id,
            }),
            fetchProducts(currentOrganization.id),
            fetchAgentMetrics(currentOrganization.id, id),
            fetchAgentRemittanceHistory(currentOrganization.id, id),
          ]);
        if (cancel) return;
        setAgents(aList);
        setProducts(productList);
        setAgent(aList.find((x) => x.id === id) || null);
        setRows(onHand.filter((r) => r.agent_id === id));
        setMovements(mv);
        setMetrics(agentMetrics);
        setRemittanceLines(remittance);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [currentOrganization, id]);

  if (Number.isNaN(id)) {
    return (
      <div className="p-8 text-destructive">Invalid agent id</div>
    );
  }

  const isWarehouse = agent?.is_warehouse === true;
  const isActive = agent?.active !== false;
  const locationLabel =
    agent?.locations?.length ? agent.locations.join(", ") : "No locations";

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          to="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to agents
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground flex flex-wrap items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            {agent?.name || `Agent #${id}`}
            {isWarehouse && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Warehouse
              </span>
            )}
            {!isActive && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                Inactive
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{locationLabel}</p>
        </div>

        <AgentContactCard agent={agent} loading={loading} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Stock held
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {loading ? "…" : (metrics?.stock_units ?? 0).toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                units
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Delivery rate
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {loading
                ? "…"
                : isWarehouse
                  ? "—"
                  : formatDeliveryRate(metrics?.delivery_rate ?? null)}
            </p>
            {!isWarehouse && metrics && metrics.orders_generated > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.orders_delivered} delivered / {metrics.orders_generated}{" "}
                assigned
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              Remittance lines
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {loading ? "…" : remittanceLines.length}
            </p>
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Package className="w-5 h-5" />
            Stock by product
          </h2>
          <StockGrid
            onHandRows={rows}
            agents={agent ? [agent] : []}
            products={products}
            loading={loading}
            filterAgentId={id}
          />
        </section>

        {canViewWallet && (
          <AgentRemittanceHistory
            lines={remittanceLines}
            loading={loading}
            agentId={id}
            canViewWallet={canViewWallet}
          />
        )}

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Movement timeline</h2>
          <StockMovementsLog
            movements={movements}
            loading={loading}
            agents={agents}
          />
        </section>
      </div>
    </div>
  );
}
