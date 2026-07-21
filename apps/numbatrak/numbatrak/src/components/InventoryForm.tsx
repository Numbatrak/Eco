import { FormEvent, useState, useEffect, useMemo, useCallback } from "react";
import { InventoryWithRelations } from "../types/inventory";
import { InventoryDialog } from "./inventory/InventoryDialog";
import {
  TransferDialog,
  TransferFormValues,
} from "./inventory/TransferDialog";
import {
  AdjustStockDialog,
  AdjustStockFormValues,
} from "./inventory/AdjustStockDialog";
import { InventoryTable } from "./inventory/InventoryTable";
import { PageHeader } from "./inventory/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import { upsertInventory } from "../services/inventory";
import { useOrganization } from "../contexts/OrganizationContext";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import {
  useCachedInventory,
  useCachedAgents,
  useCachedProducts,
} from "../hooks/useCachedData";
import { invalidateStoreCache, inventoryStore } from "../stores/dataStore";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { agentsForAssignment } from "../utils/agentFilters";

export default function InventoryForm() {
  const { currentOrganization } = useOrganization();
  const { user } = useSupabaseAuth();

  const {
    data: inventory,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useCachedInventory(currentOrganization?.id || null);
  const { data: agents, loading: agentsLoading } = useCachedAgents(
    currentOrganization?.id || null
  );
  const { data: products, loading: productsLoading } = useCachedProducts(
    currentOrganization?.id || null
  );

  const loading = inventoryLoading || agentsLoading || productsLoading;
  const error = inventoryError;

  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingInventory, setEditingInventory] =
    useState<InventoryWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [ledgerOnHand, setLedgerOnHand] = useState<AgentStockOnHandRow[]>([]);
  const [ledgerMov, setLedgerMov] = useState<StockMovement[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ledger");
  const [ledgerFilters, setLedgerFilters] = useState<InventoryLedgerFilters>(
    {}
  );

  const inventoryAssignableAgents = useMemo(
    () => agentsForAssignment(agents, editingInventory?.agent_id ?? null),
    [agents, editingInventory?.agent_id]
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
  }, [currentOrganization?.id, ledgerFilters, refreshTrigger]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const refreshAll = async () => {
    setRefreshTrigger((prev) => prev + 1);
    invalidateStoreCache(inventoryStore, currentOrganization?.id || null);
    await refetchInventory();
  };

  const handleLegacySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const agentId = formData.get("agent_id") as string;
    const productId = formData.get("product_id") as string;
    const totalQuantity = formData.get("total_quantity") as string;

    if (!productId || !totalQuantity) {
      setLocalError("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      setLocalError(null);
      if (!currentOrganization) {
        setLocalError("No organization selected");
        return;
      }

      await upsertInventory({
        agent_id: agentId ? parseInt(agentId, 10) : null,
        product_id: productId,
        total_quantity: parseInt(totalQuantity, 10),
        organization_id: currentOrganization.id,
      });

      setSuccess(
        dialogMode === "edit"
          ? "Legacy inventory updated."
          : "Legacy inventory added."
      );
      await refreshAll();
      setOpen(false);
      setEditingInventory(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Failed to save inventory.";
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  };

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
      await refreshAll();
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
      await refreshAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record.";
      setLocalError(msg);
      throw err;
    } finally {
      setAdjusting(false);
    }
  };

  const handleStartCreateLegacy = () => {
    setDialogMode("create");
    setEditingInventory(null);
    setOpen(true);
  };

  return (
    <>
      <InventoryDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setEditingInventory(null);
        }}
        mode={dialogMode}
        inventory={editingInventory}
        agents={inventoryAssignableAgents}
        products={activeProducts}
        error={localError || error}
        saving={saving}
        onSubmit={handleLegacySubmit}
      />

      <TransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setLocalError(null);
        }}
        agents={agents}
        products={activeProducts}
        onHandByAgentProduct={onHandByAgentProduct}
        error={localError || error}
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
        error={localError || error}
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
          showLegacyActions={activeTab === "legacy"}
          onAddLegacy={handleStartCreateLegacy}
        />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="ledger" className="cursor-pointer">
              Stock grid
            </TabsTrigger>
            <TabsTrigger value="legacy" className="cursor-pointer">
              Legacy totals (deprecated)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="legacy">
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
              Deprecated: manual inventory totals table. The stock grid uses{" "}
              <code className="text-xs">stock_movements</code> as the single
              source of truth for agent holdings.
            </p>
            <InventoryTable refreshTrigger={refreshTrigger} />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </>
  );
}
