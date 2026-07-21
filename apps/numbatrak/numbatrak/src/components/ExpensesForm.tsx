/** @deprecated Not routed — use UnifiedExpensesForm. See src/legacy/README.md */
import { FormEvent, useState, useEffect, useMemo } from "react";
import { AgentExpenseWithRelations } from "../types/expense";
import { ExpenseDialog } from "./expenses/ExpenseDialog";
import { ExpenseTable } from "./expenses/ExpenseTable";
import { PageHeader } from "./expenses/PageHeader";
import { MonthlyExpenseSummary } from "./expenses/MonthlyExpenseSummary";
import { AgentExpenseLeaderboard } from "./expenses/AgentExpenseLeaderboard";
import { SuccessNotification } from "./agents/SuccessNotification";
import {
  createExpense,
  updateExpense,
  removeExpense,
} from "../services/expenses";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { useCachedExpenses, useCachedAgents } from "../hooks/useCachedData";
import { invalidateStoreCache, expensesStore } from "../stores/dataStore";
import { agentsForAssignment } from "../utils/agentFilters";

export default function ExpensesForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("expenses", "canCreate");
  const canUpdate = hasPermission("expenses", "canUpdate");
  const canDelete = hasPermission("expenses", "canDelete");
  
  // Use cached hooks
  const { data: expenses, loading: expensesLoading, error: expensesError, refetch: refetchExpenses } = useCachedExpenses(currentOrganization?.id || null);
  const { data: agents, loading: agentsLoading } = useCachedAgents(currentOrganization?.id || null);
  
  const loading = expensesLoading || agentsLoading;
  const error = expensesError;
  
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingExpense, setEditingExpense] =
    useState<AgentExpenseWithRelations | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const assignableAgents = useMemo(
    () => agentsForAssignment(agents, editingExpense?.agent_id ?? null),
    [agents, editingExpense?.agent_id]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const date = formData.get("date") as string;
    const category = formData.get("category") as string;
    const amount = formData.get("amount") as string;
    const agentId = formData.get("agent_id") as string;

    if (!date || !category || !amount) {
      setLocalError("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      setLocalError(null);

      const expenseData = {
        date,
        category,
        amount: parseFloat(amount),
        agent_id: agentId ? parseInt(agentId) : null,
      };

      if (dialogMode === "edit" && editingExpense) {
        await updateExpense(editingExpense.id, expenseData);
        setSuccess("Expense updated successfully!");
      } else {
        if (!currentOrganization) {
          setLocalError("No organization selected");
          return;
        }
        await createExpense({
          ...expenseData,
          organization_id: currentOrganization.id,
        });
        setSuccess("Expense created successfully!");
      }

      // Invalidate cache and refetch
      invalidateStoreCache(expensesStore, currentOrganization?.id || null);
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

  const handleStartEdit = (expense: AgentExpenseWithRelations) => {
    setDialogMode("edit");
    setEditingExpense(expense);
    setOpen(true);
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!(await confirmDelete(confirm, "expense"))) return;

    try {
      setLocalError(null);
      await removeExpense(expenseId);
      setSuccess("Expense deleted successfully!");
      // Invalidate cache and refetch
      invalidateStoreCache(expensesStore, currentOrganization?.id || null);
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
        expense.agent?.name.toLowerCase().includes(query) ||
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
      <ExpenseDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setEditingExpense(null);
          }
        }}
        mode={dialogMode}
        expense={editingExpense}
        agents={assignableAgents}
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

          <AgentExpenseLeaderboard expenses={expenses} loading={loading} />

          <MonthlyExpenseSummary />

          <ExpenseTable
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
