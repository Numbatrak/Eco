import { useState, useEffect, useCallback, useMemo } from "react";
import { FormResponseDialog } from "./formResponses/FormResponseDialog";
import { FormResponseTable } from "./formResponses/FormResponseTable";
import { ManualOrderDialog, ManualOrderFormValues } from "./orders/ManualOrderDialog";
import { SuccessNotification } from "./agents/SuccessNotification";
import { AugmentedFormResponse } from "../utils/customerOrderAdapters";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { formatCsrSelectLabel } from "../utils/userDisplay";
import { CsrUserOption } from "./users/CsrUserOption";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { useCachedAgents } from "../hooks/useCachedData";
import { useActivityLogger } from "../utils/activityLogger";
import { fetchForms } from "../services/forms";
import { fetchProducts } from "../services/products";
import { Form } from "../types/form";
import { Product } from "../types/product";
import { fetchCustomerRelationsUsers } from "../services/customerRelations";
import {
  listOrderIntake,
  updateOrderIntake,
  updateOrderIntakeNotes,
  deleteOrderIntake,
  markOrderDelivered,
  advanceOrderStatus,
  markOrderFailedDelivery,
  addOrderUpsell,
  createManualOrder,
} from "../services/orderIntake";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import { isDeliveredStatus } from "../constants/orderStatus";
import { csrScopeFilter } from "../utils/specRoles";
import {
  FormResponseFilters,
  FormResponseWithItems,
} from "../types/formResponse";
import { PageLayout } from "./layout/PageLayout";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

const DEFAULT_ORDER_FILTERS: FormResponseFilters = {
  response_type: "order",
};

export default function OrdersForm() {
  const { hasPermission, userRole } = usePermissions();
  const { user } = useSupabaseAuth();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const { data: agents = [] } = useCachedAgents(
    currentOrganization?.id ?? null
  );
  const { logActivityAction } = useActivityLogger();
  const canUpdate = hasPermission("orders", "canUpdate");
  const canCreate = hasPermission("orders", "canCreate");
  const canDelete = hasPermission("orders", "canDelete");

  const [responses, setResponses] = useState<FormResponseWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [editingResponse, setEditingResponse] =
    useState<FormResponseWithItems | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FormResponseFilters>(
    DEFAULT_ORDER_FILTERS
  );
  const [forms, setForms] = useState<Form[]>([]);
  const [csrUsers, setCsrUsers] = useState<
    { id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [supportsCsrFilter, setSupportsCsrFilter] = useState(true);

  const scopedCsrId = useMemo(
    () => csrScopeFilter(userRole, user?.id),
    [userRole, user?.id]
  );

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      ...(scopedCsrId ? { csr_id: scopedCsrId } : {}),
    }),
    [filters, scopedCsrId]
  );

  const formOptions = useMemo(
    () => forms.map((f) => ({ id: f.id, name: f.name })),
    [forms]
  );
  const csrOptions = useMemo(
    () =>
      csrUsers.map((u) => ({
        id: u.id,
        name: formatCsrSelectLabel(u),
        full_name: u.full_name,
        email: u.email,
      })),
    [csrUsers]
  );
  const agentOptions = useMemo(
    () => agents.map((a) => ({ id: a.id, name: a.name })),
    [agents]
  );

  const funnelOptions = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.funnel_name) set.add(r.funnel_name);
    });
    return [...set].sort();
  }, [responses]);

  const subBrandOptions = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.sub_brand) set.add(r.sub_brand);
    });
    return [...set].sort();
  }, [responses]);

  useEffect(() => {
    if (!currentOrganization) {
      setForms([]);
      setProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [formList, productList] = await Promise.all([
          fetchForms(currentOrganization.id),
          fetchProducts(currentOrganization.id, { activeOnly: true }),
        ]);
        if (!cancelled) {
          setForms(formList);
          setProducts(productList);
        }
      } catch (e) {
        console.error("Error loading forms/products:", e);
        if (!cancelled) {
          setForms([]);
          setProducts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  useEffect(() => {
    (async () => {
      try {
        if (!currentOrganization) {
          setCsrUsers([]);
          return;
        }
        const users = await fetchCustomerRelationsUsers(currentOrganization.id);
        setCsrUsers(
          users.map((u) => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email,
          }))
        );
      } catch {
        setCsrUsers([]);
      }
    })();
  }, [currentOrganization?.id]);

  useEffect(() => {
    setFilters(DEFAULT_ORDER_FILTERS);
  }, [currentOrganization?.id]);

  const loadFormResponses = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      setError(null);
      const data = await listOrderIntake({
        organizationId: currentOrganization.id,
        filters: effectiveFilters,
        searchQuery,
      });
      setResponses(data.rows);
      setSupportsCsrFilter(data.supportsCsrFilter && !scopedCsrId);
    } catch (err: any) {
      console.error("Error loading form responses:", err);
      setError(err.message || "Failed to load form responses");
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, effectiveFilters, searchQuery, scopedCsrId]);

  useEffect(() => {
    loadFormResponses();
  }, [loadFormResponses]);

  const refreshAfterAction = async () => {
    await loadFormResponses();
    if (editingResponse) {
      const data = await listOrderIntake({
        organizationId: currentOrganization!.id,
        filters: effectiveFilters,
        searchQuery,
      });
      const updated = data.rows.find((r) => r.id === editingResponse.id);
      if (updated) setEditingResponse(updated);
    }
  };

  const handleSave = async (updates: {
    status?: string;
    notes?: string;
    delivery_fee?: number | null;
    amount_paid?: number | null;
    agent_id?: number | null;
    money_received_by?: MoneyReceivedBy;
  }) => {
    if (!editingResponse) return;

    try {
      setSaving(true);
      setLocalError(null);

      await updateOrderIntake(editingResponse, updates);
      setSuccess("Order updated successfully!");

      await logActivityAction(
        "form_response_updated",
        "form_response",
        (editingResponse.form_response_id || editingResponse.id) as any,
        `Order updated for ${editingResponse.customer_name || "customer"}`
      );

      await loadFormResponses();
      setOpen(false);
      setEditingResponse(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error updating form response:", err);
      setLocalError(
        err.message || "Failed to update form response. Please try again."
      );
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDelivered = async () => {
    if (!editingResponse) return;
    setSaving(true);
    setLocalError(null);
    try {
      await markOrderDelivered(editingResponse);
      setSuccess("Order marked delivered.");
      await refreshAfterAction();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setLocalError(err.message || "Failed to mark delivered.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdvance = async () => {
    if (!editingResponse) return;
    setSaving(true);
    setLocalError(null);
    try {
      await advanceOrderStatus(editingResponse);
      setSuccess("Order status advanced.");
      await refreshAfterAction();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setLocalError(err.message || "Failed to advance status.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleQuickFailed = async () => {
    if (!editingResponse) return;
    const ok = await confirm({
      title: "Mark failed delivery?",
      description:
        "This sets status to failed and records a failed-delivery expense using the delivery fee.",
      confirmLabel: "Mark failed",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    setLocalError(null);
    try {
      await markOrderFailedDelivery(editingResponse, { userId: user?.id });
      setSuccess("Order marked as failed delivery.");
      await refreshAfterAction();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setLocalError(err.message || "Failed to mark failed delivery.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpsell = async (line: {
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }) => {
    if (!editingResponse) return;
    await addOrderUpsell(editingResponse, line);
    setSuccess("Upsell line added.");
    await refreshAfterAction();
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleManualCreate = async (values: ManualOrderFormValues) => {
    if (!currentOrganization) return;
    setManualSaving(true);
    setLocalError(null);
    try {
      await createManualOrder({
        organization_id: currentOrganization.id,
        customer_name: values.customer_name,
        phone_number: values.phone_number || null,
        state: values.state || null,
        delivery_address: values.delivery_address || null,
        agent_id: values.agent_id,
        delivery_fee: values.delivery_fee,
        amount_paid: values.amount_paid,
        money_received_by: values.money_received_by,
        notes: values.notes || null,
        funnel_name: values.funnel_name || null,
        offer_name: values.offer_name || null,
        sub_brand: values.sub_brand || null,
        items: values.items,
      });
      setSuccess("Manual order created.");
      setManualOpen(false);
      await loadFormResponses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setLocalError(err.message || "Failed to create order.");
      throw err;
    } finally {
      setManualSaving(false);
    }
  };

  const handleNotesUpdate = async (responseId: string, notes: string) => {
    try {
      const row = responses.find((r) => r.id === responseId) as
        | AugmentedFormResponse
        | undefined;
      if (!row) return;
      await updateOrderIntakeNotes(row, notes);
      await loadFormResponses();
    } catch (err: any) {
      console.error("Error updating notes:", err);
      throw err;
    }
  };

  const handleStartEdit = (response: FormResponseWithItems) => {
    setDialogMode("edit");
    setEditingResponse(response);
    setOpen(true);
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (!(await confirmDelete(confirm, "order"))) return;

    try {
      setLocalError(null);
      const responseToDelete = responses.find((r) => r.id === responseId) as
        | AugmentedFormResponse
        | undefined;
      if (!responseToDelete) return;
      await deleteOrderIntake(responseToDelete);
      setSuccess("Order deleted successfully!");

      await logActivityAction(
        "form_response_deleted",
        "form_response",
        (responseToDelete?.form_response_id || responseId) as any,
        `Order deleted${
          responseToDelete
            ? ` (${responseToDelete.customer_name || "customer"})`
            : ""
        }`
      );

      await loadFormResponses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting form response:", err);
      setLocalError(
        err.message || "Failed to delete form response. Please try again."
      );
    }
  };

  const filteredAndSortedResponses = responses
    .filter((response) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          response.customer_name?.toLowerCase().includes(query) ||
          response.phone_number?.toLowerCase().includes(query) ||
          response.package_name?.toLowerCase().includes(query) ||
          response.funnel_name?.toLowerCase().includes(query) ||
          response.offer_name?.toLowerCase().includes(query) ||
          response.notes?.toLowerCase().includes(query) ||
          response.status?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (filters.agent_id != null && response.agent_id !== filters.agent_id) {
        return false;
      }
      if (filters.sub_brand && response.sub_brand !== filters.sub_brand) {
        return false;
      }
      if (filters.funnel_name && response.funnel_name !== filters.funnel_name) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "customer_name":
          comparison = (a.customer_name || "").localeCompare(
            b.customer_name || ""
          );
          break;
        case "phone_number":
          comparison = (a.phone_number || "").localeCompare(
            b.phone_number || ""
          );
          break;
        case "package_name":
          comparison = (a.package_name || "").localeCompare(
            b.package_name || ""
          );
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "profit":
          comparison = (a.profit || 0) - (b.profit || 0);
          break;
        case "created_at":
        default:
          comparison =
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime();
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const handleSortChange = (column: string, order?: "asc" | "desc") => {
    if (order) {
      setSortOrder(order);
    } else if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("asc");
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortOrder, sortColumn]);

  const deliveredOrders = filteredAndSortedResponses.filter((r) =>
    isDeliveredStatus(r.status)
  );
  const totalDeliveredProfit = deliveredOrders.reduce(
    (sum, r) => sum + (r.profit ?? 0),
    0
  );

  return (
    <>
      <FormResponseDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setEditingResponse(null);
        }}
        mode={dialogMode}
        response={editingResponse}
        agents={agents}
        products={products}
        error={localError || error}
        saving={saving}
        onSave={handleSave}
        quickActions={canUpdate}
        onMarkDelivered={canUpdate ? handleQuickDelivered : undefined}
        onAdvanceStatus={canUpdate ? handleQuickAdvance : undefined}
        onMarkFailed={canUpdate ? handleQuickFailed : undefined}
        onAddUpsell={canUpdate ? handleAddUpsell : undefined}
      />

      <ManualOrderDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        agents={agents}
        products={products}
        error={localError}
        saving={manualSaving}
        onSubmit={handleManualCreate}
      />

      <PageLayout>
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
            <p className="text-muted-foreground text-sm">
              Month-sectioned pipeline — filter by product, agent, funnel, or
              status
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={() => {
                setLocalError(null);
                setManualOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New order
            </Button>
          )}
        </div>

        {deliveredOrders.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total profit (delivered orders)
                </p>
                <p
                  className={`text-3xl font-extrabold tracking-tight ${
                    totalDeliveredProfit >= 0
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  ₦
                  {totalDeliveredProfit.toLocaleString("en-NG", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-muted-foreground">
                  {deliveredOrders.length} delivered order
                  {deliveredOrders.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        <FormResponseTable
          responses={filteredAndSortedResponses}
          agents={agents}
          loading={loading}
          error={localError || error}
          onEdit={canUpdate ? handleStartEdit : () => {}}
          onDelete={canDelete ? handleDeleteResponse : () => {}}
          onNotesUpdate={canUpdate ? handleNotesUpdate : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortColumn={sortColumn}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={setFilters}
          formOptions={formOptions}
          csrOptions={supportsCsrFilter ? csrOptions : []}
          agentOptions={agentOptions}
          funnelOptions={funnelOptions}
          subBrandOptions={subBrandOptions}
          groupByMonth
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemsPerPage={20}
          canEdit={canUpdate}
          canDelete={canDelete}
        />
      </PageLayout>
    </>
  );
}
