import { FormEvent, useState } from "react";
import { Agent } from "../types/agent";
import type { AgentMetrics } from "../services/agentMetrics";
import { AgentDialog } from "./agents/AgentDialog";
import { AgentTable } from "./agents/AgentTable";
import { PageHeader } from "./agents/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import { createAgent, updateAgent, removeAgent, setAgentActive } from "../services/agents";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { useCachedAgents } from "../hooks/useCachedAgents";
import { PageLayout } from "./layout/PageLayout";

// NOTE: agent performance metrics (delivery rate, stock on hand) and the
// activity-feed audit log are both sourced from features not yet ported off
// Supabase (Orders/Stock, Activities) - agentMetrics stays permanently empty
// and activity logging is skipped here until those land. AgentTable already
// renders gracefully with no metrics data.
export default function AgentsForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("agents", "canCreate");
  const canUpdate = hasPermission("agents", "canUpdate");
  const canDelete = hasPermission("agents", "canDelete");

  // Use cached agents data
  const {
    data: agents,
    loading,
    error,
    updateItem,
    removeItem,
  } = useCachedAgents(currentOrganization?.id || null);

  const [agentName, setAgentName] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [localError, setLocalError] = useState<string | null>(null);
  const [agentMetrics] = useState<Map<number, AgentMetrics>>(new Map());
  const [metricsLoading] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agentName.trim()) return;

    const locationsToSave =
      selectedLocations.length > 0 ? selectedLocations : ["Not specified"];

    try {
      setSaving(true);
      setLocalError(null);

      if (dialogMode === "edit" && editingAgentId) {
        const updatedAgent = await updateAgent(editingAgentId, {
          name: agentName.trim(),
          locations: locationsToSave,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          contact_email: contactEmail,
        });
        updateItem(updatedAgent); // Update cache
        setSuccess("Agent updated successfully!");
      } else {
        if (!currentOrganization) {
          return;
        }
        const newAgent = await createAgent({
          name: agentName.trim(),
          locations: locationsToSave,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          contact_email: contactEmail,
        });
        updateItem(newAgent); // Update cache
        setSuccess("Agent created successfully!");
      }

      resetForm();
      setOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving agent:", err);
      setLocalError(err.message || "Failed to save agent. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setAgentName("");
    setSelectedLocations([]);
    setContactPerson("");
    setContactPhone("");
    setContactEmail("");
    setEditingAgentId(null);
    setDialogMode("create");
  };

  const handleStartCreate = () => {
    setDialogMode("create");
    resetForm();
    setOpen(true);
  };

  const handleStartEdit = (agent: Agent) => {
    setDialogMode("edit");
    setEditingAgentId(agent.id);
    setAgentName(agent.name);
    setSelectedLocations(agent.locations ?? []);
    setContactPerson(agent.contact_person ?? "");
    setContactPhone(agent.contact_phone ?? "");
    setContactEmail(agent.contact_email ?? "");
    setOpen(true);
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!(await confirmDelete(confirm, "agent"))) return;

    try {
      await removeAgent(agentId);
      removeItem(agentId);
      setSuccess("Agent deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting agent:", err);
    }
  };

  const handleSetAgentActive = async (agent: Agent, active: boolean) => {
    const action = active ? "Reactivate" : "Deactivate";
    if (
      !(await confirm({
        title: `${action} agent?`,
        description: active
          ? `"${agent.name}" will be available for new order assignments again.`
          : `"${agent.name}" will stop receiving new orders. Delivery and expense history is preserved.`,
        confirmLabel: action,
        destructive: !active,
      }))
    ) {
      return;
    }

    try {
      setLocalError(null);
      const updated = await setAgentActive(agent.id, active);
      updateItem(updated);
      setSuccess(
        active
          ? "Agent reactivated successfully!"
          : "Agent deactivated successfully!"
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error("Error updating agent status:", err);
      setLocalError(
        err instanceof Error
          ? err.message
          : `Failed to ${action.toLowerCase()} agent. Please try again.`
      );
    }
  };

  const activeAgentCount = agents.filter((agent) => agent.active !== false).length;
  const filteredAndSortedAgents = agents
    .filter((agent: Agent) => {
      if (hideInactive && agent.active === false) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        agent.name.toLowerCase().includes(query) ||
        agent.contact_person?.toLowerCase().includes(query) ||
        agent.contact_phone?.toLowerCase().includes(query) ||
        agent.contact_email?.toLowerCase().includes(query) ||
        agent.locations?.some((loc: string) =>
          loc.toLowerCase().includes(query)
        ) ||
        agent.id.toString().includes(query)
      );
    })
    .sort((a: Agent, b: Agent) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <>
      <AgentDialog
        open={open}
        onOpenChange={setOpen}
        mode={dialogMode}
        agentName={agentName}
        onAgentNameChange={setAgentName}
        selectedLocations={selectedLocations}
        onLocationsChange={setSelectedLocations}
        contactPerson={contactPerson}
        onContactPersonChange={setContactPerson}
        contactPhone={contactPhone}
        onContactPhoneChange={setContactPhone}
        contactEmail={contactEmail}
        onContactEmailChange={setContactEmail}
        error={error}
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

          <PageHeader onAddNew={handleStartCreate} showAddButton={canCreate} />

          <AgentTable
            agents={filteredAndSortedAgents}
            agentMetrics={agentMetrics}
            metricsLoading={metricsLoading}
            activeCount={activeAgentCount}
            loading={loading}
            error={localError || error || null}
            onEdit={canUpdate ? handleStartEdit : () => {}}
            onDelete={canDelete ? handleDeleteAgent : () => {}}
            onSetActive={canUpdate ? handleSetAgentActive : undefined}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            canEdit={canUpdate}
            canDelete={canDelete}
            hideInactive={hideInactive}
            onHideInactiveChange={setHideInactive}
          />
      </PageLayout>
    </>
  );
}
