import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "../types/form";
import { FormTable } from "./forms/FormTable";
import { PageHeader } from "./forms/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import {
  fetchForms,
  removeForm,
} from "../services/forms";
import { usePermissions } from "../hooks/usePermissions";
import { PageLayout } from "./layout/PageLayout";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";

export default function FormsForm() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("forms", "canCreate");
  const canUpdate = hasPermission("forms", "canUpdate");
  const canDelete = hasPermission("forms", "canDelete");
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadForms = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchForms(currentOrganization.id);
      setForms(data);
    } catch (err: any) {
      console.error("Error loading forms:", err);
      setError(err.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const handleStartCreate = () => {
    navigate("/forms/create");
  };

  const handleStartEdit = (form: Form) => {
    navigate(`/forms/${form.id}/edit`);
  };

  const handleDeleteForm = async (formId: string) => {
    if (
      !(await confirm({
        title: "Delete form?",
        description:
          "This will permanently delete this form and its configuration. This action cannot be undone.",
        confirmLabel: "Delete",
        destructive: true,
      }))
    ) {
      return;
    }

    try {
      setError(null);
      await removeForm(formId);
      setForms(forms.filter((f) => f.id !== formId));
      setSuccess("Form deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting form:", err);
      setError(err.message || "Failed to delete form");
    }
  };

  const filteredAndSortedForms = forms
    .filter((form) =>
      form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.form_token.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <PageLayout>
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

          <PageHeader onAddNew={handleStartCreate} showAddButton={canCreate} />

          <FormTable
            forms={filteredAndSortedForms}
            loading={loading}
            error={error}
            onEdit={canUpdate ? handleStartEdit : () => {}}
            onDelete={canDelete ? handleDeleteForm : () => {}}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
    </PageLayout>
  );
}
