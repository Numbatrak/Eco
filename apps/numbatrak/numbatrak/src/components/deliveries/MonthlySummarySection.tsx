import { useEffect, useState, useMemo } from "react";
import { MonthlySummaryTable } from "./MonthlySummaryTable";
import { MonthlySummaryQueryOptions } from "../../services/deliveries";
import { useOrganization } from "../../contexts/OrganizationContext";
import { fetchAgents } from "../../services/agents";
import { fetchProducts } from "../../services/products";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

/** Quarterly/monthly waybill summary — formerly the standalone Summary page. */
export function MonthlySummarySection({
  embedded = false,
  queryOptions: externalQueryOptions,
}: {
  embedded?: boolean;
  queryOptions?: MonthlySummaryQueryOptions;
}) {
  const { currentOrganization } = useOrganization();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quarter, setQuarter] = useState<"all" | "Q1" | "Q2" | "Q3" | "Q4">("all");
  const [agentId, setAgentId] = useState<string>("all");
  const [productId, setProductId] = useState<string>("all");
  const [csr, setCsr] = useState("");

  useEffect(() => {
    if (embedded || !currentOrganization) {
      if (!embedded) {
        setAgents([]);
        setProducts([]);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          fetchAgents(currentOrganization.id),
          fetchProducts(currentOrganization.id),
        ]);
        if (!cancelled) {
          setAgents(a);
          setProducts(p);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization, embedded]);

  const queryOptions: MonthlySummaryQueryOptions = useMemo(
    () =>
      embedded && externalQueryOptions
        ? { quarter, ...externalQueryOptions }
        : {
            quarter,
            agentId: agentId !== "all" ? parseInt(agentId, 10) : undefined,
            productId: productId !== "all" ? productId : undefined,
            csrText: csr.trim() || undefined,
          },
    [embedded, externalQueryOptions, quarter, agentId, productId, csr]
  );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Monthly summary
        </h2>
        <p className="text-muted-foreground text-sm">
          Waybilled vs delivered value by month with balance roll-up.
          {embedded
            ? " Uses the page filters above (plus quarter/year below)."
            : " Filter by quarter, CSR, agent, or product."}
        </p>
      </div>

      {!embedded && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <label className="text-xs text-muted-foreground">Quarter</label>
          <Select
            value={quarter}
            onValueChange={(v) => setQuarter(v as typeof quarter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Full year (all months)</SelectItem>
              <SelectItem value="Q1">Q1 (Jan to Mar)</SelectItem>
              <SelectItem value="Q2">Q2 (Apr to Jun)</SelectItem>
              <SelectItem value="Q3">Q3 (Jul to Sep)</SelectItem>
              <SelectItem value="Q4">Q4 (Oct to Dec)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">CSR (text match)</label>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={csr}
            onChange={(e) => setCsr(e.target.value)}
            placeholder="e.g. nuella"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Agent</label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger>
              <SelectValue />
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
        <div>
          <label className="text-xs text-muted-foreground">Product</label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue />
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
      </div>
      )}

      {embedded && (
        <div className="rounded-xl border border-border bg-card p-4 max-w-xs">
          <label className="text-xs text-muted-foreground">Quarter</label>
          <Select
            value={quarter}
            onValueChange={(v) => setQuarter(v as typeof quarter)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Full year (all months)</SelectItem>
              <SelectItem value="Q1">Q1 (Jan to Mar)</SelectItem>
              <SelectItem value="Q2">Q2 (Apr to Jun)</SelectItem>
              <SelectItem value="Q3">Q3 (Jul to Sep)</SelectItem>
              <SelectItem value="Q4">Q4 (Oct to Dec)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <MonthlySummaryTable queryOptions={queryOptions} />
    </section>
  );
}
