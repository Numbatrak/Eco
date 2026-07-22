import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../auth/AuthProvider";
import { SuccessNotification } from "./agents/SuccessNotification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { TablePagination } from "./ui/TablePagination";
import { useClientPagination } from "../hooks/useClientPagination";
import { WalletDateFilterBar } from "./wallet/WalletDateFilterBar";
import { ExpenseSummaryCards } from "./expenses/ExpenseSummaryCards";
import {
  UnifiedExpenseDialog,
  expenseTableCategoryLabel,
  UnifiedExpenseFormValues,
} from "./expenses/UnifiedExpenseDialog";
import {
  fetchUnifiedExpenses,
  createUnifiedExpense,
  updateUnifiedExpense,
  deleteUnifiedExpense,
} from "../services/unifiedExpenses";
import {
  computeExpenseSummary,
  filterExpensesByDateRange,
  fetchExpenseSummary,
  fetchMonthlyExpenseSeries,
  ExpenseSummary,
  MonthlyExpensePoint,
} from "../services/expenseSummary";
import { ExpenseReportChart } from "./expenses/ExpenseReportChart";
import { fetchProducts } from "../services/products";
import {
  createCustomExpenseSubcategory,
  fetchCustomExpenseSubcategories,
  ExpenseSubcategoryRow,
} from "../services/expenseSubcategories";
import { Product } from "../types/product";
import { isAutoFedExpense } from "../utils/expenseAttribution";
import {
  ORG_EXPENSE_CATEGORY_IDS,
  OrgExpenseCategory,
} from "../constants/expenseCategories";
import {
  formatExpenseSubcategoryLabel,
} from "../utils/expenseCategoryHelpers";
import {
  UnifiedExpenseScope,
  UnifiedExpenseWithRelations,
} from "../types/unifiedExpense";
import { useCachedAgents } from "../hooks/useCachedAgents";
import { agentsForAssignment } from "../utils/agentFilters";
import { PageLayout } from "./layout/PageLayout";
import { LoadingState } from "./ui/LoadingState";
import { DateFilter, resolveDateRange } from "../utils/dateRange";

type ExpensesTab = OrgExpenseCategory | "agent";

const TAB_LABELS: Record<ExpensesTab, string> = {
  operational: "Operational",
  building: "Building",
  marketing: "Marketing",
  advertising: "Advertising",
  agent: "Agent costs",
};

export default function UnifiedExpensesForm() {
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView =
    hasPermission("generalExpenses", "canView") ||
    hasPermission("expenses", "canView");
  const canCreate =
    hasPermission("generalExpenses", "canCreate") ||
    hasPermission("expenses", "canCreate");
  const canUpdate =
    hasPermission("generalExpenses", "canUpdate") ||
    hasPermission("expenses", "canUpdate");
  const canDelete =
    hasPermission("generalExpenses", "canDelete") ||
    hasPermission("expenses", "canDelete");

  const { data: agents } = useCachedAgents(currentOrganization?.id || null);

  const [rows, setRows] = useState<UnifiedExpenseWithRelations[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<MonthlyExpensePoint[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<
    ExpenseSubcategoryRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: "this_month",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogScope, setDialogScope] = useState<UnifiedExpenseScope>("org");
  const [editingExpense, setEditingExpense] =
    useState<UnifiedExpenseWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const assignableAgents = useMemo(
    () => agentsForAssignment(agents, editingExpense?.agent_id ?? null),
    [agents, editingExpense?.agent_id]
  );

  const activeTab = (searchParams.get("tab") as ExpensesTab | null) || "operational";

  const load = useCallback(async () => {
    if (!currentOrganization) {
      setRows([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    setSummaryLoading(true);
    setErr(null);
    try {
      const [data, summaryData, series, productList, customSubs] =
        await Promise.all([
          fetchUnifiedExpenses(currentOrganization.id),
          fetchExpenseSummary(currentOrganization.id, dateFilter),
          fetchMonthlyExpenseSeries(currentOrganization.id, dateFilter),
          fetchProducts(currentOrganization.id, { activeOnly: true }),
          fetchCustomExpenseSubcategories(currentOrganization.id),
        ]);
      setRows(data);
      setSummary(summaryData);
      setMonthlySeries(series);
      setProducts(productList);
      setCustomSubcategories(customSubs);
    } catch (e) {
      console.error(e);
      setErr(
        "Could not load expenses. Run migration 20260629170000_expense_four_categories if categories were rejected."
      );
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [currentOrganization, dateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const { startDate, endDate } = resolveDateRange(dateFilter);
  const filteredRows = useMemo(
    () => filterExpensesByDateRange(rows, startDate, endDate),
    [rows, startDate, endDate]
  );

  const tabRows = useMemo(() => {
    if (activeTab === "agent") {
      return filteredRows.filter((r) => r.scope === "agent");
    }
    return filteredRows.filter(
      (r) => r.scope === "org" && r.category === activeTab
    );
  }, [filteredRows, activeTab]);

  const onTab = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  const [preferredOrgCategory, setPreferredOrgCategory] =
    useState<OrgExpenseCategory>("operational");

  const openCreate = () => {
    setDialogMode("create");
    setDialogScope(activeTab === "agent" ? "agent" : "org");
    setPreferredOrgCategory(
      activeTab !== "agent" ? activeTab : "operational"
    );
    setEditingExpense(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (expense: UnifiedExpenseWithRelations) => {
    setDialogMode("edit");
    setDialogScope(expense.scope);
    setEditingExpense(expense);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleSave = async (values: UnifiedExpenseFormValues) => {
    if (!currentOrganization) return;
    try {
      setSaving(true);
      setDialogError(null);

      if (dialogMode === "edit" && editingExpense) {
        const patch: Parameters<typeof updateUnifiedExpense>[1] = {
          note: values.note,
          product_id: values.product_id,
          offer_name: values.offer_name,
        };
        if (!isAutoFedExpense(editingExpense.source_type)) {
          patch.category = values.category;
          patch.subcategory = values.subcategory;
          patch.amount = values.amount;
          patch.agent_id = values.agent_id;
          patch.occurred_at = values.occurred_at;
        }
        await updateUnifiedExpense(editingExpense.id, patch);
        setSuccess("Expense updated.");
      } else {
        await createUnifiedExpense({
          organization_id: currentOrganization.id,
          scope: dialogScope,
          category: values.category,
          subcategory: values.subcategory,
          amount: values.amount,
          agent_id: values.agent_id,
          product_id: values.product_id,
          offer_name: values.offer_name,
          note: values.note,
          occurred_at: values.occurred_at,
          created_by: user?.id || null,
        });
        setSuccess("Expense added.");
      }

      setDialogOpen(false);
      setEditingExpense(null);
      await load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setDialogError("Failed to save expense. Check category and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete(confirm, "expense"))) return;
    await deleteUnifiedExpense(id);
    setSuccess("Expense removed.");
    await load();
    setTimeout(() => setSuccess(null), 3000);
  };

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const inlineSummary =
    summary ??
    computeExpenseSummary(filteredRows, 0);

  return (
    <PageLayout>
      {success && (
        <SuccessNotification message={success} onClose={() => setSuccess(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Four P&L categories per the developer brief: operational, building,
            marketing, and advertising (ad spend tracked separately for ROAS).
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={openCreate} className="shrink-0 cursor-pointer">
            <Plus className="h-4 w-4 mr-1.5" />
            Add expense
          </Button>
        )}
      </div>

      <WalletDateFilterBar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      <ExpenseSummaryCards summary={inlineSummary} loading={summaryLoading} />

      <ExpenseReportChart data={monthlySeries} loading={summaryLoading} />

      {err && <p className="text-destructive text-sm">{err}</p>}

      <Tabs value={activeTab} onValueChange={onTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {ORG_EXPENSE_CATEGORY_IDS.map((id) => (
            <TabsTrigger key={id} value={id} className="cursor-pointer">
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="agent" className="cursor-pointer">
            {TAB_LABELS.agent}
          </TabsTrigger>
        </TabsList>

        {(ORG_EXPENSE_CATEGORY_IDS as readonly ExpensesTab[])
          .concat(["agent"])
          .map((tabId) => (
            <TabsContent key={tabId} value={tabId} className="space-y-4">
              <ExpensesTable
                rows={tabId === activeTab ? tabRows : []}
                loading={loading && tabId === activeTab}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </TabsContent>
          ))}
      </Tabs>

      <UnifiedExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        scope={dialogScope}
        expense={editingExpense}
        agents={assignableAgents}
        products={products}
        customSubcategories={customSubcategories}
        onAddCustomSubcategory={async (parentCategory, label) => {
          if (!currentOrganization) return;
          await createCustomExpenseSubcategory({
            organization_id: currentOrganization.id,
            parent_category: parentCategory,
            label,
          });
          const subs = await fetchCustomExpenseSubcategories(
            currentOrganization.id
          );
          setCustomSubcategories(subs);
        }}
        preferredOrgCategory={
          dialogMode === "create" && dialogScope === "org"
            ? preferredOrgCategory
            : undefined
        }
        error={dialogError}
        saving={saving}
        onSubmit={handleSave}
      />
    </PageLayout>
  );
}

function ExpensesTable({
  rows,
  loading,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: UnifiedExpenseWithRelations[];
  loading: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (row: UnifiedExpenseWithRelations) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
  } = useClientPagination(rows, 15);

  if (loading) {
    return <LoadingState label="Loading expenses…" className="py-16" />;
  }
  if (!rows.length) {
    return (
      <p className="text-muted-foreground text-sm rounded-xl border border-dashed border-border p-8 text-center">
        No expenses in this category for the selected period.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="p-2 text-muted-foreground font-medium">Date</th>
              <th className="p-2 text-muted-foreground font-medium">Category</th>
              <th className="p-2 text-muted-foreground font-medium">Subcategory</th>
              <th className="p-2 text-muted-foreground font-medium">Amount</th>
              <th className="p-2 text-muted-foreground font-medium">Agent</th>
              <th className="p-2 text-muted-foreground font-medium">Note</th>
              {(canUpdate || canDelete) && (
                <th className="p-2 text-muted-foreground font-medium text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr key={r.id} className="border-b border-border/70">
                <td className="p-2 whitespace-nowrap text-muted-foreground">
                  {String(r.occurred_at).slice(0, 10)}
                </td>
                <td className="p-2">{expenseTableCategoryLabel(r)}</td>
                <td className="p-2">
                  {formatExpenseSubcategoryLabel(r.category, r.subcategory)}
                </td>
                <td className="p-2 tabular-nums">
                  {r.amount.toLocaleString("en-NG", {
                    style: "currency",
                    currency: "NGN",
                  })}
                </td>
                <td className="p-2">{r.agent?.name || "N/A"}</td>
                <td className="p-2 max-w-xs truncate">
                  {r.note || "—"}
                  {isAutoFedExpense(r.source_type) && (
                    <span className="ml-1.5 inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Auto
                    </span>
                  )}
                  {r.product?.name && (
                    <span className="block text-xs text-muted-foreground truncate">
                      {r.product.name}
                      {r.offer_name ? ` · ${r.offer_name}` : ""}
                    </span>
                  )}
                </td>
                {(canUpdate || canDelete) && (
                  <td className="p-2 text-right space-x-2 whitespace-nowrap">
                    {canUpdate && (
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-accent cursor-pointer"
                        onClick={() => onEdit(r)}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md border border-destructive/35 text-destructive bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                        onClick={() => onDelete(r.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
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
