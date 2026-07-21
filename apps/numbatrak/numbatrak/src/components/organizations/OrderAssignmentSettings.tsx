import { useState, useEffect } from "react";
import {
  fetchOrderAssignmentSettings,
  fetchOrderAssignmentWeights,
  upsertOrderAssignmentSettings,
  upsertOrderAssignmentWeight,
  deleteOrderAssignmentWeight,
  AssignmentMethod,
  OrderAssignmentSettings,
  OrderAssignmentWeight,
} from "../../services/orderAssignmentSettings";
import { fetchOrganizationMembers } from "../../services/organizations";
import { useConfirm, confirmDelete } from "../../contexts/ConfirmContext";
import { OrganizationMember } from "../../types/organization";
import { Loader2, Save, Pause, Play, Trash2, AlertCircle, Check } from "lucide-react";
import { Switch } from "../ui/switch";
import { getDisplayName } from "../../utils/userDisplay";
import "./OrderAssignmentSettings.css";
import { LoadingState } from "../ui/LoadingState";

interface OrderAssignmentSettingsProps {
  organizationId: string;
}

export function OrderAssignmentSettings({
  organizationId,
}: OrderAssignmentSettingsProps) {
  const { confirm } = useConfirm();
  const [settings, setSettings] = useState<OrderAssignmentSettings | null>(null);
  const [weights, setWeights] = useState<OrderAssignmentWeight[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignmentMethod, setAssignmentMethod] = useState<AssignmentMethod>("round_robin");
  const [editingWeights, setEditingWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load settings
      const settingsData = await fetchOrderAssignmentSettings(organizationId);
      if (settingsData) {
        setSettings(settingsData);
        setAssignmentMethod(settingsData.assignment_method);
      } else {
        // Create default settings
        setAssignmentMethod("round_robin");
      }

      // Load weights
      const weightsData = await fetchOrderAssignmentWeights(organizationId);
      setWeights(weightsData);

      // Load members to get CSR users
      const membersData = await fetchOrganizationMembers(organizationId);
      setMembers(membersData);

      // Initialize editing weights
      const initialWeights: Record<string, number> = {};
      weightsData.forEach((weight) => {
        initialWeights[weight.user_id] = weight.percentage;
      });
      setEditingWeights(initialWeights);
    } catch (err: any) {
      console.error("Error loading order assignment settings:", err);
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      await upsertOrderAssignmentSettings(organizationId, assignmentMethod);

      const csrMembersList = members.filter((m) => m.role === "Customer Relations");

      if (assignmentMethod === "round_robin") {
        for (const member of csrMembersList) {
          if (!weights.find((w) => w.user_id === member.user_id)) {
            await upsertOrderAssignmentWeight(organizationId, member.user_id, 0, false);
          }
        }
      } else {
        const inPool = weights.filter((w) => !w.is_paused);
        if (inPool.length === 0 && csrMembersList.length > 0) {
          const base = Math.floor(100 / csrMembersList.length);
          let remainder = 100 - base * csrMembersList.length;
          for (const member of csrMembersList) {
            const pct = base + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;
            await upsertOrderAssignmentWeight(organizationId, member.user_id, pct, false);
          }
        }
      }

      setSuccess("Settings saved successfully!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving settings:", err);
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeight = async (userId: string, percentage: number) => {
    try {
      setError(null);
      const weight = weights.find((w) => w.user_id === userId);
      const isPaused = weight?.is_paused || false;

      await upsertOrderAssignmentWeight(organizationId, userId, percentage, isPaused);
      setSuccess("Weight updated successfully!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error saving weight:", err);
      setError(err.message || "Failed to save weight");
    }
  };

  const handleTogglePause = async (userId: string, isPaused: boolean) => {
    try {
      setError(null);
      const weight = weights.find((w) => w.user_id === userId);
      const percentage = weight?.percentage || editingWeights[userId] || 0;

      await upsertOrderAssignmentWeight(organizationId, userId, percentage, !isPaused);
      setSuccess(isPaused ? "CSR included in rotation" : "CSR excluded from rotation");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error toggling pause:", err);
      setError(err.message || "Failed to update pause status");
    }
  };

  const handleRemoveWeight = async (userId: string) => {
    if (!(await confirmDelete(confirm, "assignment weight", "This user will no longer receive weighted order assignments."))) {
      return;
    }

    try {
      setError(null);
      await deleteOrderAssignmentWeight(organizationId, userId);
      setSuccess("Weight removed successfully!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error removing weight:", err);
      setError(err.message || "Failed to remove weight");
    }
  };

  const handleAddWeight = async (userId: string) => {
    try {
      setError(null);
      await upsertOrderAssignmentWeight(organizationId, userId, 0, false);
      setSuccess("User added to assignment pool!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error adding weight:", err);
      setError(err.message || "Failed to add user");
    }
  };

  // Get CSR members (Customer Relations role)
  const csrMembers = members.filter((m) => m.role === "Customer Relations");
  const csrMembersWithWeights = csrMembers.map((member) => {
    const weight = weights.find((w) => w.user_id === member.user_id);
    return {
      member,
      weight,
      editingPercentage: editingWeights[member.user_id] ?? weight?.percentage ?? 0,
    };
  });

  // Calculate total percentage
  const totalPercentage = weights
    .filter((w) => !w.is_paused)
    .reduce((sum, w) => sum + w.percentage, 0);

  if (loading) {
    return (
      <div className="order-assignment-settings-container">
        <LoadingState label="Loading order assignment settings…" size="md" className="py-12" />
      </div>
    );
  }

  return (
    <div className="order-assignment-settings-container">
      <div className="order-assignment-settings-section">
        <h2 className="order-assignment-settings-title">Order Assignment Settings</h2>
        <p className="order-assignment-settings-description">
          Configure how orders are automatically assigned to Customer Relations staff
        </p>

        {(error || success) && (
          <div className="order-assignment-settings-message">
            {error && (
              <div className="order-assignment-settings-error">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="order-assignment-settings-success">
                <Check className="w-4 h-4" />
                {success}
              </div>
            )}
          </div>
        )}

        {/* Assignment Method Selection */}
        <div className="order-assignment-settings-method">
          <label className="order-assignment-settings-label">Assignment Method</label>
          <div className="order-assignment-settings-radio-group">
            <label className="order-assignment-settings-radio">
              <input
                type="radio"
                value="round_robin"
                checked={assignmentMethod === "round_robin"}
                onChange={(e) => setAssignmentMethod(e.target.value as AssignmentMethod)}
              />
              <span>Round Robin</span>
              <p className="order-assignment-settings-radio-description">
                Orders are assigned evenly in rotation to all active CSR staff
              </p>
            </label>
            <label className="order-assignment-settings-radio">
              <input
                type="radio"
                value="percentage"
                checked={assignmentMethod === "percentage"}
                onChange={(e) => setAssignmentMethod(e.target.value as AssignmentMethod)}
              />
              <span>Percentage Based</span>
              <p className="order-assignment-settings-radio-description">
                Orders are assigned based on percentage weights you set for each CSR
              </p>
            </label>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving || assignmentMethod === settings?.assignment_method}
            className="order-assignment-settings-save-btn"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Method
              </>
            )}
          </button>
        </div>

        {/* Percentage-Based Assignment Configuration */}
        {assignmentMethod === "percentage" && (
          <div className="order-assignment-settings-weights">
            <div className="order-assignment-settings-weights-header">
              <label className="order-assignment-settings-label">
                Assignment Weights
              </label>
              {totalPercentage !== 100 && (
                <div className="order-assignment-settings-total-warning">
                  Total: {totalPercentage}% (should be 100%)
                </div>
              )}
            </div>

            {csrMembersWithWeights.length === 0 ? (
              <p className="order-assignment-settings-empty">
                No Customer Relations staff found in this organization.
              </p>
            ) : (
              <div className="order-assignment-settings-weights-list">
                {csrMembersWithWeights.map(({ member, weight, editingPercentage }) => {
                  const isPaused = weight?.is_paused || false;
                  const hasWeight = weight !== undefined;

                  return (
                    <div
                      key={member.user_id}
                      className={`order-assignment-settings-weight-item ${
                        isPaused ? "paused" : ""
                      }`}
                    >
                      <div className="order-assignment-settings-weight-info">
                        <div>
                          <h4 className="order-assignment-settings-weight-name">
                            {getDisplayName(
                              {
                                full_name: member.user?.full_name,
                                email: member.user?.email,
                              },
                              "Unknown user"
                            )}
                          </h4>
                          <p className="order-assignment-settings-weight-email">
                            {member.user?.email}
                          </p>
                        </div>
                      </div>

                      {hasWeight ? (
                        <div className="order-assignment-settings-weight-controls">
                          <div className="order-assignment-settings-weight-input-group">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editingPercentage}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setEditingWeights({
                                  ...editingWeights,
                                  [member.user_id]: Math.max(0, Math.min(100, value)),
                                });
                              }}
                              className="order-assignment-settings-weight-input"
                              disabled={isPaused}
                            />
                            <span className="order-assignment-settings-weight-percent">%</span>
                            <button
                              onClick={() =>
                                handleSaveWeight(member.user_id, editingWeights[member.user_id] ?? 0)
                              }
                              disabled={editingPercentage === weight?.percentage}
                              className="order-assignment-settings-weight-save-btn"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleTogglePause(member.user_id, isPaused)}
                            className={`order-assignment-settings-weight-pause-btn ${
                              isPaused ? "paused" : ""
                            }`}
                            title={isPaused ? "Include in rotation" : "Exclude from rotation"}
                          >
                            {isPaused ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleRemoveWeight(member.user_id)}
                            className="order-assignment-settings-weight-remove-btn"
                            title="Remove from assignment pool"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddWeight(member.user_id)}
                          className="order-assignment-settings-weight-add-btn"
                        >
                          Add to Assignment Pool
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Round Robin Info */}
        {assignmentMethod === "round_robin" && (
          <div className="order-assignment-settings-round-robin-info">
            <p className="order-assignment-settings-info-text">
              In round-robin mode, orders are assigned evenly to all Customer Relations
              staff in rotation. Excluded CSRs (configured below) are skipped.
            </p>
            {csrMembers.length === 0 && (
              <p className="order-assignment-settings-empty">
                No Customer Relations staff found in this organization.
              </p>
            )}
          </div>
        )}

        {/* Exclude CSRs from round-robin rotation */}
        {assignmentMethod === "round_robin" && csrMembers.length > 0 && (
          <div className="order-assignment-settings-pause-list">
            <label className="order-assignment-settings-label">
              Exclude from rotation
            </label>
            <p className="order-assignment-settings-description">
              Excluded CSRs will not receive new order assignments
            </p>
            <div className="order-assignment-settings-pause-items">
              {csrMembers.map((member) => {
                const weight = weights.find((w) => w.user_id === member.user_id);
                const isPaused = weight?.is_paused || false;

                return (
                  <div
                    key={member.user_id}
                    className="order-assignment-settings-pause-item"
                  >
                    <div className="order-assignment-settings-pause-info">
                      <h4 className="order-assignment-settings-pause-name">
                        {getDisplayName(
                          {
                            full_name: member.user?.full_name,
                            email: member.user?.email,
                          },
                          "Unknown user"
                        )}
                      </h4>
                      <p className="order-assignment-settings-pause-email">
                        {member.user?.email}
                      </p>
                    </div>
                    <div className="order-assignment-settings-pause-controls">
                      <Switch
                        checked={isPaused}
                        onCheckedChange={() => handleTogglePause(member.user_id, isPaused)}
                      />
                      <span className="order-assignment-settings-pause-label">
                        {isPaused ? "Excluded" : "In rotation"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

