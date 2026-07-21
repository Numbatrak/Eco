/** @deprecated Not routed — use UnifiedExpensesForm. See src/legacy/README.md */
import { FormEvent, useState, useEffect } from "react";
import { GeneralExpenseWithRelations } from "../types/generalExpense";
import { GeneralExpenseDialog } from "./generalExpenses/GeneralExpenseDialog";
import { GeneralExpenseTable } from "./generalExpenses/GeneralExpenseTable";
import { PageHeader } from "./generalExpenses/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import {
  createGeneralExpense,
  updateGeneralExpense,
  removeGeneralExpense,
} from "../services/generalExpenses";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { useCachedGeneralExpenses, useCachedProducts } from "../hooks/useCachedData";
import { invalidateStoreCache, generalExpensesStore } from "../stores/dataStore";

export default function GeneralExpensesForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("generalExpenses", "canCreate");
  const canUpdate = hasPermission("generalExpenses", "canUpdate");
  const canDelete = hasPermission("generalExpenses", "canDelete");
  
  // Use cached hooks
  const { data: expenses, loading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useCachedGeneralExpenses(currentOrganization?.id || null);
  const { data: products, loading: productsLoading } = useCachedProducts(currentOrganization?.id || null);
  
  const loading = expensesLoading || productsLoading;
  const error = expensesError;
  
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingExpense, setEditingExpense] =
    useState<GeneralExpenseWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const date = formData.get("date") as string;
    const productId = formData.get("product_id") as string;
    const category = formData.get("category") as string;
    const subcategory = formData.get("subcategory") as string;
    const amount = formData.get("amount") as string;

    if (!date || !category || !subcategory || !amount) {
      setLocalError("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      setLocalError(null);

      const expenseData = {
        date,
        product_id: productId ? parseInt(productId) : null,
        category,
        subcategory,
        amount: parseFloat(amount),
      };

      if (dialogMode === "edit" && editingExpense) {
        await updateGeneralExpense(editingExpense.id, expenseData);
        setSuccess("Expense updated successfully!");
      } else {
        if (!currentOrganization) {
          setLocalError("No organization selected");
          return;
        }
        await createGeneralExpense({
          ...expenseData,
          organization_id: currentOrganization.id,
        });
        setSuccess("Expense created successfully!");
      }

      // Invalidate cache and refetch
      invalidateStoreCache(generalExpensesStore, currentOrganization?.id || null);
      await refetchExpenses();

      setOpen(false);
      setEditingExpense(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving expense:", err);
      setLocalError("Failed to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartCreate = () => {
    setDialogMode("create");
    setEditingExpense(null);
    setOpen(true);
  };

  const handleStartEdit = (expense: GeneralExpenseWithRelations) => {
    setDialogMode("edit");
    setEditingExpense(expense);
    setOpen(true);
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!(await confirmDelete(confirm, "expense"))) return;

    try {
      setLocalError(null);
      await removeGeneralExpense(expenseId);
      setSuccess("Expense deleted successfully!");
      // Invalidate cache and refetch
      invalidateStoreCache(generalExpensesStore, currentOrganization?.id || null);
      await refetchExpenses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting expense:", err);
      setLocalError("Failed to delete expense. Please try again.");
    }
  };

  // Filter and sort expenses
  const filteredAndSortedExpenses = expenses
    .filter((expense) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        expense.category.toLowerCase().includes(query) ||
        expense.subcategory.toLowerCase().includes(query) ||
        expense.product?.name.toLowerCase().includes(query) ||
        expense.date.includes(query)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filteredAndSortedExpenses.slice(
    startIndex,
    endIndex
  );

  return (
    <>
      <GeneralExpenseDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setEditingExpense(null);
          }
        }}
        mode={dialogMode}
        expense={editingExpense}
        products={products}
        error={localError || error}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <section className="min-h-screen bg-background p-6 md:p-8">
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          <PageHeader onAddNew={handleStartCreate} showAddButton={canCreate} />

          <GeneralExpenseTable
            expenses={paginatedExpenses}
            loading={loading}
            error={localError || error}
            onEdit={canUpdate ? handleStartEdit : () => {}}
            onDelete={canDelete ? handleDeleteExpense : () => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            canEdit={canUpdate}
            canDelete={canDelete}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedExpenses.length}
          />
        </div>
      </section>
    </>
  );
}
