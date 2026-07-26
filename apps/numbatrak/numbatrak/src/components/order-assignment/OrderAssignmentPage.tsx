import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchOrderAssignmentSettings,
  updateOrderAssignmentSettings,
  fetchOrderAssignmentWeights,
  upsertOrderAssignmentWeight,
  deleteOrderAssignmentWeight,
  type OrderAssignmentSettings,
  type OrderAssignmentWeight,
} from "../../services/orderAssignment";
import { fetchStaff } from "../../services/staff";
import type { Staff } from "../../types/staff";
import { Trash2, Plus, Pause, Play } from "lucide-react";

export function OrderAssignmentPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("orderAssignment", "canUpdate");

  const [settings, setSettings] = useState<OrderAssignmentSettings | null>(null);
  const [weights, setWeights] = useState<OrderAssignmentWeight[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [addUserId, setAddUserId] = useState("");
  const [addPercentage, setAddPercentage] = useState(0);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, w, staff] = await Promise.all([
        fetchOrderAssignmentSettings(),
        fetchOrderAssignmentWeights(),
        canManage ? fetchStaff(currentOrganization.id) : Promise.resolve([]),
      ]);
      setSettings(s);
      setWeights(w);
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to load order assignment data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, canManage]);

  useEffect(() => { void load(); }, [load]);

  const handleMethodChange = async (method: string) => {
    await updateOrderAssignmentSettings(method);
    void load();
  };

  const handleAddWeight = async () => {
    if (!addUserId) return;
    await upsertOrderAssignmentWeight(addUserId, addPercentage);
    setAddUserId("");
    setAddPercentage(0);
    void load();
  };

  const handleTogglePause = async (w: OrderAssignmentWeight) => {
    await upsertOrderAssignmentWeight(w.user_id, w.percentage, !w.is_paused);
    void load();
  };

  const handleDelete = async (weightId: string) => {
    await deleteOrderAssignmentWeight(weightId);
    void load();
  };

  const totalPercentage = weights.reduce((sum, w) => sum + w.percentage, 0);

  return (
    <PageLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Order Assignment</h1>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <h3 className="font-medium text-foreground">Assignment Method</h3>
            <div className="flex gap-3">
              {(["round_robin", "percentage"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => canManage && handleMethodChange(method)}
                  disabled={!canManage}
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                    settings?.assignment_method === method
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {method === "round_robin" ? "Round Robin" : "Percentage"}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {settings?.assignment_method === "round_robin"
                ? "Orders are distributed evenly in turn across active team members."
                : "Orders are distributed according to each member's configured percentage weight."}
            </p>
          </div>

          {settings?.assignment_method === "percentage" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Weight Configuration</h3>
                {totalPercentage !== 100 && weights.length > 0 && (
                  <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                    Total: {totalPercentage}% (should be 100%)
                  </span>
                )}
              </div>

              {canManage && (
                <div className="flex items-end gap-3 p-4 rounded-lg border border-border bg-card">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">Staff Member</label>
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                    >
                      <option value="">Select staff...</option>
                      {staffList
                        .filter((s) => s.active && !weights.some((w) => w.user_id === s.user_id))
                        .map((s) => (
                          <option key={s.user_id} value={s.user_id}>{s.user_name ?? s.user_email ?? s.user_id}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Percentage</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={addPercentage}
                      onChange={(e) => setAddPercentage(Number(e.target.value))}
                      className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm w-24"
                    />
                  </div>
                  <button
                    onClick={handleAddWeight}
                    disabled={!addUserId}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Percentage</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {weights.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{w.user_name ?? w.user_id}</td>
                        <td className="px-4 py-3 text-right text-foreground">{w.percentage}%</td>
                        <td className="px-4 py-3 text-center">
                          {w.is_paused ? (
                            <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">Paused</span>
                          ) : (
                            <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">Active</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleTogglePause(w)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title={w.is_paused ? "Resume" : "Pause"}
                              >
                                {w.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDelete(w.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {weights.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No weights configured. Add team members above.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
