import { useState, useEffect, FormEvent, useMemo, useCallback } from "react";
import { FollowUpWithRelations, FollowUpStatus, FollowUpPriority, FollowUpOutcome } from "../types/followUp";
import { FollowUpTable } from "./followUps/FollowUpTable";
import { FollowUpDialog } from "./followUps/FollowUpDialog";
import { FollowUpAnalytics } from "./followUps/FollowUpAnalytics";
import { FollowUpNotifications } from "./followUps/FollowUpNotifications";
import { SuccessNotification } from "./agents/SuccessNotification";
import { CustomerRelationsLeaderboard } from "./followUps/CustomerRelationsLeaderboard";
import {
  fetchFollowUps,
  removeFollowUp,
  updateFollowUp,
  fetchFollowUpsCount,
} from "../services/followUps";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../auth/AuthProvider";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { PageLayout } from "./layout/PageLayout";

export default function FollowUpsForm() {
  const { hasPermission, userRole } = usePermissions();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  
  // Memoize permission checks using userRole (stable value) instead of hasPermission function
  const canEdit = useMemo(() => hasPermission("orders", "canUpdate"), [userRole]);
  const canDelete = useMemo(() => hasPermission("orders", "canDelete"), [userRole]);
  const canViewAnalytics = useMemo(() => 
    userRole === "Owner" || userRole === "Admin" || userRole === "Manager",
    [userRole]
  );
  // Owner, Admin, and Manager can view all follow-ups; CSR can only see their own
  const canViewAll = useMemo(() => 
    userRole === "Owner" || userRole === "Admin" || userRole === "Manager",
    [userRole]
  );
  const canViewLeaderboard = canViewAnalytics;

  const [followUps, setFollowUps] = useState<FollowUpWithRelations[]>([]);
  const [open, setOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<{
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFollowUps, setTotalFollowUps] = useState(0);
  const itemsPerPage = 20;

  // Filter by current user if they're Customer Relations
  const userId = user?.id;
  
  // Memoize loadData to prevent it from being recreated on every render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (currentPage - 1) * itemsPerPage;
      const limit = itemsPerPage;

      const orgId = currentOrganization?.id ?? null;
      const followUpsData = await fetchFollowUps(
        orgId,
        offset,
        limit,
        sortOrder,
        filters,
        searchQuery || undefined
      );
      setFollowUps(followUpsData);

      const count = await fetchFollowUpsCount(
        orgId,
        filters,
        searchQuery || undefined
      );
      setTotalFollowUps(count);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortOrder, filters, searchQuery, itemsPerPage, currentOrganization?.id]);

  // Filter by current user if they're Customer Relations
  useEffect(() => {
    if (!userId) {
      // User logged out, clear filters
      setFilters({});
      return;
    }

    if (!canViewAll) {
      // Customer Relations can only see their own follow-ups
      setFilters((prev) => {
        // Only update if the assigned_to filter is different
        if (prev.assigned_to === userId) {
          return prev; // No change needed, prevent infinite loop
        }
        return { ...prev, assigned_to: userId };
      });
    } else {
      // Owner/Admin/Manager can view all follow-ups - ensure assigned_to filter is removed
      setFilters((prev) => {
        // If assigned_to is already undefined, no change needed
        if (prev.assigned_to === undefined) {
          return prev;
        }
        // Remove assigned_to filter to show all follow-ups
        const { assigned_to, ...rest } = prev;
        return rest;
      });
    }
  }, [userId, canViewAll]); // Use userId and canViewAll (both are stable values)

  // Load data when dependencies change
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortOrder, filters, searchQuery]);

  const handleEdit = (followUp: FollowUpWithRelations) => {
    setEditingFollowUp(followUp);
    setOpen(true);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingFollowUp) return;

    const formData = new FormData(e.currentTarget);

    try {
      setSaving(true);
      setError(null);

      const updateData: any = {
        status: (formData.get("status") as FollowUpStatus) || editingFollowUp.status,
        priority: (formData.get("priority") as FollowUpPriority) || editingFollowUp.priority,
        notes: (formData.get("notes") as string) || null,
      };

      // Handle assignment change (if user has permission)
      const assignedToValue = formData.get("assigned_to") as string;
      if (assignedToValue !== null && assignedToValue !== undefined) {
        updateData.assigned_to = assignedToValue === "" ? null : assignedToValue;
      }

      // Handle status changes
      const newStatus = updateData.status;
      if (newStatus === "followed_up" && editingFollowUp.status !== "followed_up") {
        updateData.first_contact_at = new Date().toISOString();
      }

      if (newStatus === "resolved" && editingFollowUp.status !== "resolved") {
        updateData.completed_at = new Date().toISOString();
        updateData.outcome = (formData.get("outcome") as FollowUpOutcome) || null;
      }

      await updateFollowUp(editingFollowUp.id, updateData);
      setSuccess("Follow-up updated successfully!");
      await loadData();
      setOpen(false);
      setEditingFollowUp(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating follow-up:", err);
      setError("Failed to update follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFollowUp = async (followUpId: number) => {
    if (!(await confirmDelete(confirm, "follow-up"))) return;

    try {
      setError(null);
      await removeFollowUp(followUpId);
      setSuccess("Follow-up deleted successfully!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting follow-up:", err);
      setError("Failed to delete follow-up. Please try again.");
    }
  };

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortOrder]);

  return (
    <>
      <FollowUpDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setEditingFollowUp(null);
            setError(null);
          }
        }}
        followUp={editingFollowUp}
        error={error}
        saving={saving}
        onSubmit={handleSubmit}
        mode="edit"
      />

      <PageLayout>
        <FollowUpNotifications />
        {success && (
          <SuccessNotification message={success} onClose={() => setSuccess(null)} />
        )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground">
                Follow-Ups
              </h1>
              <p className="text-muted-foreground text-sm">
                Track and manage customer representative follow-up activities
              </p>
            </div>
          </div>

          {canViewAnalytics && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Analytics Dashboard</h2>
              <FollowUpAnalytics
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                repId={filters.assigned_to}
              />
            </div>
          )}

          {canViewLeaderboard && (
            <div className="bg-card rounded-xl border border-border p-6">
              <CustomerRelationsLeaderboard
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
              />
            </div>
          )}

          <FollowUpTable
            followUps={followUps}
            loading={loading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDeleteFollowUp}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            filters={filters}
            onFilterChange={setFilters}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalFollowUps}
            canEdit={canEdit}
            canDelete={canDelete}
          />
      </PageLayout>
    </>
  );
}

