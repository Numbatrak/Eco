import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchLeaveSettings,
  updateLeaveSettings,
  fetchLeaveBalances,
  fetchLeaveRequests,
  createLeaveRequest,
  decideLeaveRequest,
  type LeaveSettings,
  type LeaveBalance,
  type LeaveRequest,
} from "../../services/leave";
import { Check, X, Plus, Clock } from "lucide-react";

const LEAVE_TYPES = ["annual", "sick", "emergency", "unpaid"] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function LeavePage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("leave", "canUpdate");

  const [tab, setTab] = useState<"requests" | "balances" | "settings">("requests");
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<string>("annual");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newDays, setNewDays] = useState(1);
  const [newReason, setNewReason] = useState("");

  const [editAnnual, setEditAnnual] = useState(0);
  const [editSick, setEditSick] = useState(0);
  const [editEmergency, setEditEmergency] = useState(0);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, b, r] = await Promise.all([
        fetchLeaveSettings(),
        fetchLeaveBalances(),
        fetchLeaveRequests(),
      ]);
      setBalances(b);
      setRequests(r);
      setEditAnnual(s.annual_days);
      setEditSick(s.sick_days);
      setEditEmergency(s.emergency_days);
    } catch (err) {
      console.error("Failed to load leave data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newStartDate || !newEndDate) return;
    await createLeaveRequest({
      leaveType: newType,
      startDate: newStartDate,
      endDate: newEndDate,
      days: newDays,
      reason: newReason || null,
    });
    setShowCreate(false);
    setNewType("annual");
    setNewStartDate("");
    setNewEndDate("");
    setNewDays(1);
    setNewReason("");
    void load();
  };

  const handleDecide = async (requestId: string, status: "approved" | "declined") => {
    await decideLeaveRequest(requestId, status);
    void load();
  };

  const handleSaveSettings = async () => {
    await updateLeaveSettings({
      annualDays: editAnnual,
      sickDays: editSick,
      emergencyDays: editEmergency,
    });
    void load();
  };

  const tabs = [
    { key: "requests" as const, label: "Requests" },
    { key: "balances" as const, label: "Balances" },
    ...(canManage ? [{ key: "settings" as const, label: "Settings" }] : []),
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full"><Check className="w-3 h-3" /> Approved</span>;
      case "declined":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full"><X className="w-3 h-3" /> Declined</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <PageLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Leave</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : tab === "requests" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dates</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{r.staff_name ?? r.staff_id}</td>
                    <td className="px-4 py-3 text-foreground capitalize">{r.leave_type}</td>
                    <td className="px-4 py-3 text-foreground">{formatDate(r.start_date)} - {formatDate(r.end_date)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{r.days}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "-"}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        {r.status === "pending" && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDecide(r.id, "approved")}
                              className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDecide(r.id, "declined")}
                              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                              title="Decline"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No leave requests.</div>
          )}
        </div>
      ) : tab === "balances" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Annual</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sick</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Emergency</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Unpaid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balances.map((b) => (
                  <tr key={b.staff_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{b.staff_name ?? b.staff_id}</td>
                    <td className="px-4 py-3 text-center text-foreground">{b.annual_used}/{b.annual_entitled} <span className="text-xs text-muted-foreground">({b.annual_remaining} left)</span></td>
                    <td className="px-4 py-3 text-center text-foreground">{b.sick_used}/{b.sick_entitled} <span className="text-xs text-muted-foreground">({b.sick_remaining} left)</span></td>
                    <td className="px-4 py-3 text-center text-foreground">{b.emergency_used}/{b.emergency_entitled} <span className="text-xs text-muted-foreground">({b.emergency_remaining} left)</span></td>
                    <td className="px-4 py-3 text-center text-foreground">{b.unpaid_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {balances.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No active staff found.</div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-card space-y-4 max-w-md">
          <h3 className="font-medium text-foreground">Leave Entitlements (days per year)</h3>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Annual Leave</label>
            <input
              type="number"
              min={0}
              value={editAnnual}
              onChange={(e) => setEditAnnual(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Sick Leave</label>
            <input
              type="number"
              min={0}
              value={editSick}
              onChange={(e) => setEditSick(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Emergency Leave</label>
            <input
              type="number"
              min={0}
              value={editEmergency}
              onChange={(e) => setEditEmergency(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Save Settings
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-popover border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-medium text-foreground">Request Leave</h3>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Leave Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Days</label>
              <input
                type="number"
                min={1}
                value={newDays}
                onChange={(e) => setNewDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Reason (optional)</label>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newStartDate || !newEndDate}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
