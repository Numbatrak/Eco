import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TransferDialog,
  TransferFormValues,
} from "./inventory/TransferDialog";
import {
  AdjustStockDialog,
  AdjustStockFormValues,
} from "./inventory/AdjustStockDialog";
import { PageHeader } from "./inventory/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../auth/AuthProvider";
import { useCachedAgents } from "../hooks/useCachedAgents";
import { useCachedProducts } from "../hooks/useCachedProducts";
import {
  fetchAgentStockOnHand,
  buildOnHandMap,
} from "../services/agentStock";
import {
  listStockMovements,
  createTransferMovement,
  createShrinkageMovement,
} from "../services/stockMovements";
import { ensureWarehouseAgent } from "../services/warehouse";
import { AgentStockOnHandRow } from "../types/stockMovement";
import { StockMovement } from "../types/stockMovement";
import { StockGrid } from "./inventory/StockGrid";
import { PageLayout } from "./layout/PageLayout";
import { StockMovementsLog } from "./inventory/StockMovementsLog";
import {
  InventoryFilters,
  InventoryLedgerFilters,
} from "./inventory/InventoryFilters";

export default function InventoryForm() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const { data: agents, loading: agentsLoading } = useCachedAgents(
    currentOrganization?.id || null
  );
  const { data: products, loading: productsLoading } = useCachedProducts(
    currentOrganization?.id || null
  );

  const loading = agentsLoading || productsLoading;

  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ledgerOnHand, setLedgerOnHand] = useState<AgentStockOnHandRow[]>([]);
  const [ledgerMov, setLedgerMov] = useState<StockMovement[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState<InventoryLedgerFilters>(
    {}
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.active !== false),
    [products]
  );

  const onHandByAgentProduct = useMemo(
    () => buildOnHandMap(ledgerOnHand),
    [ledgerOnHand]
  );

  const loadLedger = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLedgerOnHand([]);
      setLedgerMov([]);
      return;
    }
    setLedgerLoading(true);
    try {
      await ensureWarehouseAgent(currentOrganization.id).catch(() => {
        /* migration may not be applied yet */
      });
      const [onHand, movements] = await Promise.all([
        fetchAgentStockOnHand(currentOrganization.id),
        listStockMovements(currentOrganization.id, {
          limit: 200,
          agent_id: ledgerFilters.agent_id,
          product_id: ledgerFilters.product_id,
          movement_type: ledgerFilters.movement_type,
          date_from: ledgerFilters.date_from,
          date_to: ledgerFilters.date_to,
        }),
      ]);
      setLedgerOnHand(onHand);
      setLedgerMov(movements);
    } catch (e) {
      console.warn("Ledger view:", e);
      setLedgerOnHand([]);
      setLedgerMov([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [currentOrganization?.id, ledgerFilters]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const handleTransfer = async (values: TransferFormValues) => {
    if (!currentOrganization) return;
    setTransferring(true);
    setLocalError(null);
    try {
      await createTransferMovement({
        organization_id: currentOrganization.id,
        from_agent_id: values.from_agent_id,
        to_agent_id: values.to_agent_id,
        product_id: values.product_id,
        quantity: values.quantity,
        notes: values.notes,
        recorded_by_user_id: user?.id ?? null,
      });
      setSuccess("Stock transferred on the ledger.");
      setTransferOpen(false);
      await loadLedger();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transfer failed.";
      setLocalError(msg);
      throw err;
    } finally {
      setTransferring(false);
    }
  };

  const handleAdjust = async (values: AdjustStockFormValues) => {
    if (!currentOrganization) return;
    setAdjusting(true);
    setLocalError(null);
    try {
      await createShrinkageMovement({
        organization_id: currentOrganization.id,
        movement_type: values.movement_type,
        from_agent_id: values.agent_id,
        product_id: values.product_id,
        quantity: values.quantity,
        notes: values.notes,
        recorded_by_user_id: user?.id ?? null,
      });
      setSuccess(
        values.movement_type === "damaged"
          ? "Damaged stock recorded."
          : "Missing stock recorded."
      );
      setAdjustOpen(false);
      await loadLedger();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record.";
      setLocalError(msg);
      throw err;
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <>
      <TransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setLocalError(null);
        }}
        agents={agents}
        products={activeProducts}
        onHandByAgentProduct={onHandByAgentProduct}
        error={localError}
        saving={transferring}
        onSubmit={handleTransfer}
      />

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={(open) => {
          setAdjustOpen(open);
          if (!open) setLocalError(null);
        }}
        agents={agents}
        products={activeProducts}
        onHandByAgentProduct={onHandByAgentProduct}
        error={localError}
        saving={adjusting}
        onSubmit={handleAdjust}
      />

      <PageLayout>
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        <PageHeader
          onTransfer={() => {
            setLocalError(null);
            setTransferOpen(true);
          }}
          onAdjust={() => {
            setLocalError(null);
            setAdjustOpen(true);
          }}
        />

        <div className="space-y-4">
          <InventoryFilters
            agents={agents}
            products={activeProducts}
            filters={ledgerFilters}
            onChange={setLedgerFilters}
          />
          <StockGrid
            onHandRows={ledgerOnHand}
            agents={agents}
            products={activeProducts}
            loading={ledgerLoading || loading}
            filterAgentId={ledgerFilters.agent_id}
            filterProductId={ledgerFilters.product_id}
          />
          <h3 className="text-sm font-semibold text-foreground">
            Movement history
          </h3>
          <StockMovementsLog
            movements={ledgerMov}
            loading={ledgerLoading}
            agents={agents}
          />
        </div>
      </PageLayout>
    </>
  );
}
