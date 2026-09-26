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
import { useCachedAgents } from "../hooks/useCachedAgents";
import { useCachedProducts } from "../hooks/useCachedProducts";
import {
  fetchStockGrid,
  buildOnHandMap,
} from "../services/agentStock";
import {
  listStockMovements,
  createTransferMovement,
  createShrinkageMovement,
} from "../services/stockMovements";
import { ensureWarehouseAgent } from "../services/warehouse";
import { loadInventorySettings, DEFAULT_INVENTORY_SETTINGS } from "../services/inventorySettings";
import { AgentStockOnHandRow } from "../types/stockMovement";
import { ProductWithDetails } from "../types/product";
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
  const [costOfInventory, setCostOfInventory] = useState(0);
  const [ledgerMov, setLedgerMov] = useState<StockMovement[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState<InventoryLedgerFilters>(
    {}
  );
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(
    DEFAULT_INVENTORY_SETTINGS.defaultLowStockThreshold
  );

  useEffect(() => {
    let cancelled = false;
    loadInventorySettings(currentOrganization?.id).then((settings) => {
      if (!cancelled) setDefaultLowStockThreshold(settings.defaultLowStockThreshold);
    });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const activeProducts = useMemo(
    // useCachedProducts hits the same /details endpoint as
    // fetchProductsWithDetails and narrows the result to the base Product
    // type - the runtime objects still carry `variants` (see
    // services/products.ts's fetchProducts comment), so this cast just
    // restores visibility of a field that was always there.
    () => products.filter((product) => product.active !== false) as ProductWithDetails[],
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
      const [grid, movements] = await Promise.all([
        // Fetched unfiltered - StockGrid applies sub-brand/location/agent/product
        // filters client-side so the transfer/adjust dialogs' on-hand map (built
        // from this same data) always sees every agent's real holdings.
        fetchStockGrid(currentOrganization.id),
        listStockMovements(currentOrganization.id, {
          limit: 200,
          agent_id: ledgerFilters.agent_id,
          product_id: ledgerFilters.product_id,
          movement_type: ledgerFilters.movement_type,
          sub_brand: ledgerFilters.sub_brand,
          location: ledgerFilters.location,
          date_from: ledgerFilters.date_from,
          date_to: ledgerFilters.date_to,
        }),
      ]);
      setLedgerOnHand(grid.rows);
      setCostOfInventory(grid.costOfInventory);
      setLedgerMov(movements);
    } catch (e) {
      console.warn("Ledger view:", e);
      setLedgerOnHand([]);
      setCostOfInventory(0);
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
        variant_id: values.variant_id,
        quantity: values.quantity,
        notes: values.notes,
        fee: values.fee,
      });
      setSuccess(
        values.fee > 0
          ? "Stock transferred on the ledger — fee recorded as an expense."
          : "Stock transferred on the ledger."
      );
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
        variant_id: values.variant_id,
        quantity: values.quantity,
        notes: values.notes,
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
            filterSubBrand={ledgerFilters.sub_brand}
            filterLocation={ledgerFilters.location}
            costOfInventory={costOfInventory}
            defaultLowStockThreshold={defaultLowStockThreshold}
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
