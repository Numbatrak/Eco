import { FormEvent, useState, useMemo, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { WaybillBatchDialog } from "./deliveries/WaybillBatchDialog";
import { DeliveryWithRelations } from "../types/delivery";
import { DeliveryDialog } from "./deliveries/DeliveryDialog";
import { DeliveryTable } from "./deliveries/DeliveryTable";
import { PageHeader } from "./deliveries/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import {
  updateDelivery,
  removeDelivery,
} from "../services/deliveries";
import { intakeWaybill, intakeDeliveryRecord } from "../services/waybillIntake";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { useCachedDeliveries } from "../hooks/useCachedDeliveries";
import { useCachedAgents } from "../hooks/useCachedAgents";
import { useCachedProducts } from "../hooks/useCachedProducts";
import { invalidateStoreCache, deliveriesStore } from "../stores/dataStore";
import { PageLayout } from "./layout/PageLayout";
import { useClientPagination } from "../hooks/useClientPagination";
import { agentsForAssignment, filterStockHolders } from "../utils/agentFilters";

export default function DeliveriesForm() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("deliveries", "canCreate");
  const canUpdate = hasPermission("deliveries", "canUpdate");
  const canDelete = hasPermission("deliveries", "canDelete");
  
  // Use cached hooks
  const { data: deliveries, loading: deliveriesLoading, error: deliveriesError, refetch: refetchDeliveries } = useCachedDeliveries(currentOrganization?.id || null);
  const { data: agents, loading: agentsLoading } = useCachedAgents(currentOrganization?.id || null);
  const { data: products, loading: productsLoading } = useCachedProducts(currentOrganization?.id || null);
  
  const loading = deliveriesLoading || agentsLoading || productsLoading;
  const error = deliveriesError;
  
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingDelivery, setEditingDelivery] =
    useState<DeliveryWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<{
    date?: string;
    agentId?: number;
    csr?: string;
    productId?: string;
    status?: "Waybilled" | "Delivered";
    month?: string;
    subBrand?: string;
  }>({});
  const [subBrandOptions, setSubBrandOptions] = useState<string[]>([]);
  const [waybillOpen, setWaybillOpen] = useState(false);

  // Dashboard's own cross-domain sub-brand aggregation isn't ported yet -
  // this just uses what's visible in the loaded deliveries themselves.
  useEffect(() => {
    const fromDeliveries = deliveries
      .map((d) => d.sub_brand?.trim())
      .filter(Boolean) as string[];
    setSubBrandOptions([...new Set(fromDeliveries)].sort());
  }, [deliveries]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const date = formData.get("date") as string;
    const csr = formData.get("csr") as string;
    const agentId = formData.get("agent_id") as string;
    const status = formData.get("status") as "Waybilled" | "Delivered";
    const productId = formData.get("product_id") as string;
    const quantity = formData.get("quantity") as string;
    const cost = formData.get("cost") as string;
    const waybillingFee = formData.get("waybilling_fee") as string;
    const subBrand = (formData.get("sub_brand") as string) || null;

    if (!date || !status || !productId || !quantity || !cost) {
      setLocalError("Please fill in all required fields.");
      return;
    }

      try {
      setSaving(true);
      setLocalError(null);

      const deliveryData = {
        date,
        csr: csr || null,
        agent_id: agentId ? parseInt(agentId, 10) : null,
        status,
        product_id: productId,
        quantity: parseInt(quantity, 10),
        cost: parseFloat(cost),
        waybilling_fee: waybillingFee ? parseFloat(waybillingFee) : 0,
        sub_brand: subBrand,
      };

      if (dialogMode === "edit" && editingDelivery) {
        await updateDelivery(editingDelivery.id, deliveryData);
        setSuccess("Delivery updated successfully!");
      } else {
        if (!currentOrganization) {
          setLocalError("No organization selected");
          return;
        }
        if (status === "Waybilled" && deliveryData.agent_id) {
          await intakeWaybill({
            organization_id: currentOrganization.id,
            date: deliveryData.date,
            csr: deliveryData.csr,
            agent_id: deliveryData.agent_id,
            product_id: deliveryData.product_id,
            quantity: deliveryData.quantity,
            cost: deliveryData.cost,
            waybilling_fee: deliveryData.waybilling_fee,
            sub_brand: deliveryData.sub_brand,
            recorded_by_user_id: user?.id ?? null,
          });
        } else {
          await intakeDeliveryRecord({
            organization_id: currentOrganization.id,
            ...deliveryData,
          });
        }
        setSuccess("Delivery created successfully!");
      }

      // Invalidate cache and refetch
      invalidateStoreCache(deliveriesStore, currentOrganization?.id || null);
      await refetchDeliveries();

      setOpen(false);
      setEditingDelivery(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error("Error saving delivery:", err);
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "";
      setLocalError(
        msg
          ? `Failed to save delivery: ${msg}`
          : "Failed to save delivery. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartCreate = () => {
    setDialogMode("create");
    setEditingDelivery(null);
    setOpen(true);
  };

  const handleStartEdit = (delivery: DeliveryWithRelations) => {
    setDialogMode("edit");
    setEditingDelivery(delivery);
    setOpen(true);
  };

  const handleDeleteDelivery = async (deliveryId: number) => {
    if (!(await confirmDelete(confirm, "delivery"))) return;

    try {
      setLocalError(null);
      await removeDelivery(deliveryId);
      setSuccess("Delivery deleted successfully!");
      // Invalidate cache and refetch
      invalidateStoreCache(deliveriesStore, currentOrganization?.id || null);
      await refetchDeliveries();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting delivery:", err);
      setLocalError("Failed to delete delivery. Please try again.");
    }
  };

  // Filter and sort deliveries
  const filteredAndSortedDeliveries = deliveries
    .filter((delivery) => {
      // Text search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          delivery.csr?.toLowerCase().includes(query) ||
          delivery.agent?.name.toLowerCase().includes(query) ||
          delivery.product?.name.toLowerCase().includes(query) ||
          delivery.status.toLowerCase().includes(query) ||
          delivery.date.includes(query);
        if (!matchesSearch) return false;
      }

      // Date filter
      if (filters.date) {
        if (delivery.date !== filters.date) return false;
      }

      // Agent filter
      if (filters.agentId !== undefined) {
        if (delivery.agent_id !== filters.agentId) return false;
      }

      // CSR filter
      if (filters.csr) {
        const csrQuery = filters.csr.toLowerCase();
        if (!delivery.csr?.toLowerCase().includes(csrQuery)) return false;
      }

      // Product filter
      if (filters.productId !== undefined) {
        if (delivery.product_id !== filters.productId) return false;
      }

      if (filters.status && delivery.status !== filters.status) {
        return false;
      }

      if (filters.month) {
        if (!delivery.date.startsWith(filters.month)) return false;
      }

      if (filters.subBrand) {
        if ((delivery.sub_brand ?? "") !== filters.subBrand) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: paginatedDeliveries,
  } = useClientPagination(filteredAndSortedDeliveries);

  const assignableAgents = useMemo(
    () => agentsForAssignment(agents, editingDelivery?.agent_id ?? null),
    [agents, editingDelivery?.agent_id]
  );

  const waybillAgents = useMemo(
    () => filterStockHolders(agents),
    [agents]
  );

  return (
    <>
      {currentOrganization && (
        <WaybillBatchDialog
          open={waybillOpen}
          onOpenChange={setWaybillOpen}
          organizationId={currentOrganization.id}
          agents={waybillAgents}
          products={products}
          recordedByUserId={user?.id ?? null}
          onSuccess={async () => {
            if (currentOrganization) {
              invalidateStoreCache(
                deliveriesStore,
                currentOrganization.id || null
              );
              await refetchDeliveries();
            }
            setSuccess("Waybill batch posted — stock, deliveries, and fees recorded.");
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}
      <DeliveryDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setEditingDelivery(null);
          }
        }}
        mode={dialogMode}
        delivery={editingDelivery}
        agents={assignableAgents}
        products={products}
        subBrandOptions={subBrandOptions}
        error={localError || error}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <PageLayout>
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

          <PageHeader
            onAddNew={handleStartCreate}
            showAddButton={canCreate}
            extraActions={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => setWaybillOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Bulk Waybill Out
                </button>
              ) : null
            }
          />

          <DeliveryTable
            deliveries={paginatedDeliveries}
            loading={loading}
            error={localError || error}
            onEdit={canUpdate ? handleStartEdit : () => {}}
            onDelete={canDelete ? handleDeleteDelivery : () => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            agents={agents}
            products={products}
            subBrandOptions={subBrandOptions}
            filters={filters}
            onFilterChange={setFilters}
            canEdit={canUpdate}
            canDelete={canDelete}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
          />
      </PageLayout>
    </>
  );
}
