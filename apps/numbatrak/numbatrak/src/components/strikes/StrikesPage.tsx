import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchStaff } from "../../services/staff";
import {
  fetchStrikeSettings,
  updateStrikeSettings,
  fetchStrikes,
  issueStrikes,
  clearStrike,
  type StrikeSettings,
  type Strike,
} from "../../services/strikes";
import type { Staff } from "../../types/staff";
import { AlertTriangle, Plus, X, Settings } from "lucide-react";

export function StrikesPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("strikes", "canCreate");

  const [settings, setSettings] = useState<StrikeSettings | null>(null);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [thresholdPeriod, setThresholdPeriod] = useState("month");
  const [consequence, setConsequence] = useState("HR review");

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [settingsData, strikesData, staffData] = await Promise.all([
        fetchStrikeSettings(),
        fetchStrikes(),
        fetchStaff(currentOrganization.id),
      ]);
      setSettings(settingsData);
      setStrikes(strikesData);
      setStaff(staffData);
      setThreshold(settingsData.threshold);
      setThresholdPeriod(settingsData.threshold_period);
      setConsequence(settingsData.consequence);
    } catch (err) {
      console.error("Failed to load strikes data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { void load(); }, [load]);

  const handleIssue = async () => {
    if (selectedStaffIds.length === 0 || !reason.trim()) return;
    await issueStrikes(selectedStaffIds, reason.trim());
    setShowIssue(false);
    setSelectedStaffIds([]);
    setReason("");
    void load();
  };

  const handleClear = async (strikeId: string) => {
    await clearStrike(strikeId);
    void load();
  };

  const handleSaveSettings = async () => {
    await updateStrikeSettings({ threshold, thresholdPeriod, consequence });
    setShowSettings(false);
    void load();
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  };

  const activeStrikes = strikes.filter((s) => !s.cleared);
  const clearedStrikes = strikes.filter((s) => s.cleared);

  return (
    <PageLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Strikes</h1>
        <div className="flex items-center gap-3">
          {canManage && (
            <>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => setShowIssue(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Issue Strike
              </button>
            </>
          )}
        </div>
      </div>

      {settings && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Threshold: {settings.threshold} strikes / {settings.threshold_period}</span>
          <span>Consequence: {settings.consequence}</span>
        </div>
      )}

      {showSettings && canManage && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="font-medium text-foreground">Strike Settings</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Threshold</label>
              <input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Period</label>
              <select
                value={thresholdPeriod}
                onChange={(e) => setThresholdPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Consequence</label>
              <input
                type="text"
                value={consequence}
                onChange={(e) => setConsequence(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Save
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showIssue && canManage && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="font-medium text-foreground">Issue Strike</h3>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Select staff members:</label>
            <div className="flex flex-wrap gap-2">
              {staff.filter((s) => s.active).map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleStaff(s.id)}
                  className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                    selectedStaffIds.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.user_name ?? s.user_email ?? s.id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Reason</label>
            <input
              type="text"
              placeholder="Strike reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleIssue}
              disabled={selectedStaffIds.length === 0 || !reason.trim()}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
            >
              Issue Strike ({selectedStaffIds.length} selected)
            </button>
            <button
              onClick={() => { setShowIssue(false); setSelectedStaffIds([]); setReason(""); }}
              className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {activeStrikes.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-foreground mb-3">Active Strikes ({activeStrikes.length})</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued By</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeStrikes.map((strike) => (
                      <tr key={strike.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            {strike.staff_name ?? strike.staff_id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{strike.reason}</td>
                        <td className="px-4 py-3 text-muted-foreground">{strike.issued_by_name ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(strike.issued_at).toLocaleDateString()}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleClear(strike.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Clear strike"
                            >
                              <X className="w-3 h-3" />
                              Clear
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStrikes.length === 0 && clearedStrikes.length === 0 && (
            <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
              No strikes recorded.
            </div>
          )}

          {clearedStrikes.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-muted-foreground mb-3">Cleared Strikes ({clearedStrikes.length})</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cleared</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clearedStrikes.map((strike) => (
                      <tr key={strike.id} className="hover:bg-muted/30 opacity-60">
                        <td className="px-4 py-3 text-foreground">{strike.staff_name ?? strike.staff_id}</td>
                        <td className="px-4 py-3 text-foreground">{strike.reason}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(strike.issued_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {strike.cleared_at ? new Date(strike.cleared_at).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
