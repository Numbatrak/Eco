import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStarSettings,
  updateStarSettings,
  fetchStarTiers,
  createStarTier,
  deleteStarTier,
  fetchStars,
  awardStar,
  fetchLeaderboard,
  type StarSettings,
  type StarTier,
  type StarRecord,
  type LeaderboardEntry,
} from "../../services/stars";
import { fetchStaff } from "../../services/staff";
import type { Staff } from "../../types/staff";
import { Star, Trophy, Plus, Trash2, Award } from "lucide-react";

export function StarsPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("stars", "canUpdate");

  const [tab, setTab] = useState<"leaderboard" | "history" | "tiers" | "settings">("leaderboard");
  const [settings, setSettings] = useState<StarSettings | null>(null);
  const [tiers, setTiers] = useState<StarTier[]>([]);
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAward, setShowAward] = useState(false);
  const [awardStaffId, setAwardStaffId] = useState("");
  const [awardPoints, setAwardPoints] = useState(1);
  const [awardReason, setAwardReason] = useState("");

  const [newTierName, setNewTierName] = useState("");
  const [newTierMinPoints, setNewTierMinPoints] = useState(0);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, t, st, lb, staff] = await Promise.all([
        fetchStarSettings(),
        fetchStarTiers(),
        fetchStars(),
        fetchLeaderboard(),
        canManage ? fetchStaff(currentOrganization.id) : Promise.resolve([]),
      ]);
      setSettings(s);
      setTiers(t);
      setStars(st);
      setLeaderboard(lb);
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to load stars data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, canManage]);

  useEffect(() => { void load(); }, [load]);

  const handleAward = async () => {
    if (!awardStaffId || !awardReason.trim()) return;
    await awardStar(awardStaffId, awardPoints, awardReason);
    setShowAward(false);
    setAwardStaffId("");
    setAwardPoints(1);
    setAwardReason("");
    void load();
  };

  const handleCreateTier = async () => {
    if (!newTierName.trim()) return;
    await createStarTier({ name: newTierName, minPoints: newTierMinPoints, displayOrder: tiers.length });
    setNewTierName("");
    setNewTierMinPoints(0);
    void load();
  };

  const handleDeleteTier = async (tierId: string) => {
    await deleteStarTier(tierId);
    void load();
  };

  const handleToggleEnabled = async () => {
    if (!settings) return;
    await updateStarSettings({ enabled: !settings.enabled });
    void load();
  };

  const tabs = [
    { key: "leaderboard" as const, label: "Leaderboard" },
    { key: "history" as const, label: "History" },
    ...(canManage ? [{ key: "tiers" as const, label: "Tiers" }, { key: "settings" as const, label: "Settings" }] : []),
  ];

  return (
    <PageLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Stars & Leaderboard</h1>
        {canManage && (
          <button
            onClick={() => setShowAward(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Award className="w-4 h-4" />
            Award Star
          </button>
        )}
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
      ) : tab === "leaderboard" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Points</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map((entry) => (
                  <tr key={entry.staff_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground">
                      {entry.rank <= 3 ? (
                        <Trophy className={`w-4 h-4 inline ${entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-gray-400" : "text-amber-700"}`} />
                      ) : (
                        entry.rank
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{entry.staff_name ?? entry.staff_id}</td>
                    <td className="px-4 py-3 text-right text-foreground">{entry.total_points}</td>
                    <td className="px-4 py-3 text-foreground">
                      {entry.tier_name ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                          <Star className="w-3 h-3" /> {entry.tier_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No stars awarded yet.</div>
          )}
        </div>
      ) : tab === "history" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Points</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Awarded By</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stars.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{s.staff_name ?? s.staff_id}</td>
                    <td className="px-4 py-3 text-right text-foreground">{s.points}</td>
                    <td className="px-4 py-3 text-foreground">{s.reason}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.awarded_by_name ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(s.awarded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stars.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No star history.</div>
          )}
        </div>
      ) : tab === "tiers" ? (
        <div className="space-y-4">
          {canManage && (
            <div className="flex items-end gap-3 p-4 rounded-lg border border-border bg-card">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tier Name</label>
                <input
                  type="text"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  placeholder="e.g. Gold"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Min Points</label>
                <input
                  type="number"
                  value={newTierMinPoints}
                  onChange={(e) => setNewTierMinPoints(Number(e.target.value))}
                  className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm w-24"
                />
              </div>
              <button
                onClick={handleCreateTier}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Add Tier
              </button>
            </div>
          )}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Min Points</th>
                  {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{tier.name}</td>
                    <td className="px-4 py-3 text-right text-foreground">{tier.min_points}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteTier(tier.id)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {tiers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No tiers configured.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">Stars Module</div>
                <div className="text-sm text-muted-foreground">Enable or disable the stars framework</div>
              </div>
              <button
                onClick={handleToggleEnabled}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  settings?.enabled
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {settings?.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-popover border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-medium text-foreground">Award Star</h3>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Staff Member</label>
              <select
                value={awardStaffId}
                onChange={(e) => setAwardStaffId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="">Select staff...</option>
                {staffList.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>{s.user_name ?? s.user_email ?? s.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Points</label>
              <input
                type="number"
                min={1}
                value={awardPoints}
                onChange={(e) => setAwardPoints(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Reason</label>
              <textarea
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAward(false)}
                className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAward}
                disabled={!awardStaffId || !awardReason.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Award
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
