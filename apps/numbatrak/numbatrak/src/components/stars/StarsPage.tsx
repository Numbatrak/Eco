import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStarSettings,
  updateStarSettings,
  fetchStarTiers,
  createStarTier,
  updateStarTier,
  deleteStarTier,
  fetchStars,
  awardStar,
  fetchLeaderboard,
  fetchSotmCandidates,
  confirmSotm,
  type StarSettings,
  type StarTier,
  type StarRecord,
  type LeaderboardEntry,
  type SotmCandidate,
  type LeaderboardStyle,
  type SotmCriteria,
} from "../../services/stars";
import { fetchStaff } from "../../services/staff";
import type { Staff } from "../../types/staff";
import { Star, Trophy, Plus, Trash2, Award, Crown } from "lucide-react";
import { sanitizeIntegerInput, sanitizeDecimalInput } from "../../utils/numericInput";

const LEADERBOARD_STYLES: { value: LeaderboardStyle; label: string }[] = [
  { value: "by_tier", label: "By star tier" },
  { value: "by_revenue", label: "By revenue" },
  { value: "by_delivery_rate", label: "By delivery rate" },
  { value: "by_upsells", label: "By upsells" },
];

const SOTM_CRITERIA: { value: SotmCriteria; label: string }[] = [
  { value: "manual", label: "Manual head's-choice" },
  { value: "highest_delivery", label: "Highest delivery (count)" },
  { value: "highest_delivery_rate", label: "Highest delivery rate" },
  { value: "highest_revenue", label: "Highest revenue" },
  { value: "highest_revenue_per_order", label: "Highest revenue per order" },
  { value: "highest_star_tier", label: "Highest star tier" },
  { value: "most_upsells", label: "Most upsells" },
];

function valueLabel(style: LeaderboardStyle): string {
  if (style === "by_revenue") return "Revenue";
  if (style === "by_delivery_rate") return "Delivery rate";
  if (style === "by_upsells") return "Upsells";
  return "Tier rank";
}

function formatValue(style: LeaderboardStyle, value: number): string {
  if (style === "by_revenue") return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  if (style === "by_delivery_rate") return `${value.toFixed(1)}%`;
  return String(value);
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function StarsPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("stars", "canUpdate");

  const [tab, setTab] = useState<"leaderboard" | "history" | "tiers" | "sotm" | "settings">("leaderboard");
  const [settings, setSettings] = useState<StarSettings | null>(null);
  const [tiers, setTiers] = useState<StarTier[]>([]);
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [sotmMonth] = useState(getCurrentMonth);
  const [sotmCandidates, setSotmCandidates] = useState<SotmCandidate[]>([]);
  const [sotmCriteria, setSotmCriteria] = useState<SotmCriteria>("manual");
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [sotmMessage, setSotmMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAward, setShowAward] = useState(false);
  const [awardStaffId, setAwardStaffId] = useState("");
  const [awardTierId, setAwardTierId] = useState("");
  const [awardReason, setAwardReason] = useState("");

  const [newTierName, setNewTierName] = useState("");
  const [newTierMinPoints, setNewTierMinPoints] = useState(0);
  const [newTierCriteria, setNewTierCriteria] = useState("");

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, t, st, lb, sotm, staff] = await Promise.all([
        fetchStarSettings(),
        fetchStarTiers(),
        fetchStars(),
        fetchLeaderboard(),
        fetchSotmCandidates(),
        canManage ? fetchStaff(currentOrganization.id) : Promise.resolve([]),
      ]);
      setSettings(s);
      setTiers(t);
      setStars(st);
      setLeaderboard(lb);
      setSotmCandidates(sotm.candidates);
      setSotmCriteria(sotm.criteria);
      setStaffList(staff);
    } catch (err) {
      console.error("Failed to load stars data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, canManage]);

  useEffect(() => { void load(); }, [load]);

  const handleAward = async () => {
    if (!awardStaffId || !awardTierId || !awardReason.trim()) return;
    await awardStar(awardStaffId, awardTierId, awardReason);
    setShowAward(false);
    setAwardStaffId("");
    setAwardTierId("");
    setAwardReason("");
    void load();
  };

  const handleCreateTier = async () => {
    if (!newTierName.trim()) return;
    await createStarTier({
      name: newTierName,
      minPoints: newTierMinPoints,
      displayOrder: tiers.length,
      criteria: newTierCriteria.trim() || null,
    });
    setNewTierName("");
    setNewTierMinPoints(0);
    setNewTierCriteria("");
    void load();
  };

  const handleUpdateTierCriteria = async (tier: StarTier, criteria: string) => {
    await updateStarTier(tier.id, { criteria: criteria.trim() || null });
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

  const handleUpdateSettings = async (patch: Parameters<typeof updateStarSettings>[0]) => {
    await updateStarSettings(patch);
    void load();
  };

  const toggleWinner = (staffId: string) => {
    setSelectedWinners((prev) => (prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]));
  };

  const handleConfirmSotm = async () => {
    if (selectedWinners.length === 0) return;
    setSotmMessage(null);
    const result = await confirmSotm(sotmMonth, selectedWinners);
    if (result.skipped.length > 0) {
      setSotmMessage(
        `Awarded ${result.awarded.length}. Skipped: ${result.skipped.map((s) => s.reason).join(" ")}`
      );
    } else {
      setSotmMessage(`Star of the Month confirmed for ${result.awarded.length} winner(s) — flowing to Payroll.`);
    }
    setSelectedWinners([]);
    void load();
  };

  const tabs = [
    { key: "leaderboard" as const, label: "Leaderboard" },
    { key: "history" as const, label: "History" },
    ...(canManage
      ? [
          { key: "tiers" as const, label: "Tiers" },
          { key: "sotm" as const, label: "Star of the Month" },
          { key: "settings" as const, label: "Settings" },
        ]
      : []),
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

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
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
          <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/30">
            Ranked {LEADERBOARD_STYLES.find((s) => s.value === settings?.leaderboard_style)?.label.toLowerCase() ?? "by star tier"} — change this under Settings.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    {valueLabel(settings?.leaderboard_style ?? "by_tier")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Current tier</th>
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
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatValue(settings?.leaderboard_style ?? "by_tier", entry.value)}
                    </td>
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
            <div className="p-8 text-center text-muted-foreground">No active staff yet.</div>
          )}
        </div>
      ) : tab === "history" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier awarded</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Awarded By</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stars.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{s.staff_name ?? s.staff_id}</td>
                    <td className="px-4 py-3 text-foreground">{s.tier_name ?? "—"}</td>
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
            <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-border bg-card">
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
                <label className="block text-xs text-muted-foreground mb-1">Display order</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newTierMinPoints}
                  onChange={(e) => {
                    const v = sanitizeIntegerInput(e.target.value);
                    setNewTierMinPoints(v === "" ? 0 : Number(v));
                  }}
                  className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm w-28"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Higher = better tier</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-muted-foreground mb-1">What earns this tier</label>
                <input
                  type="text"
                  value={newTierCriteria}
                  onChange={(e) => setNewTierCriteria(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  placeholder="e.g. Consistent 90%+ delivery rate for 3 months"
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">What earns it</th>
                  {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{tier.name}</td>
                    <td className="px-4 py-3 text-right text-foreground">{tier.display_order}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {canManage ? (
                        <input
                          type="text"
                          defaultValue={tier.criteria ?? ""}
                          onBlur={(e) => handleUpdateTierCriteria(tier, e.target.value)}
                          className="w-full px-2 py-1 rounded border border-transparent hover:border-border focus:border-border bg-transparent text-sm"
                          placeholder="Not set"
                        />
                      ) : (
                        tier.criteria ?? "—"
                      )}
                    </td>
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
      ) : tab === "sotm" ? (
        <div className="space-y-4">
          {!settings?.sotm_enabled && (
            <div className="p-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Star of the Month is switched off — enable it under Settings.
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {sotmMonth} — ranked by {SOTM_CRITERIA.find((c) => c.value === sotmCriteria)?.label.toLowerCase()}
            </p>
            {canManage && (
              <button
                onClick={handleConfirmSotm}
                disabled={selectedWinners.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Crown className="w-4 h-4" /> Confirm {selectedWinners.length || ""} winner{selectedWinners.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
          {sotmMessage && <p className="text-sm text-foreground">{sotmMessage}</p>}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {canManage && <th className="px-4 py-3 w-10" />}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sotmCandidates.map((c) => (
                  <tr key={c.staff_id} className={`hover:bg-muted/30 ${!c.eligible ? "opacity-50" : ""}`}>
                    {canManage && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          disabled={!c.eligible}
                          checked={selectedWinners.includes(c.staff_id)}
                          onChange={() => toggleWinner(c.staff_id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground">{c.staff_name ?? c.staff_id}</td>
                    <td className="px-4 py-3 text-foreground">{c.tier_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{c.value ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.eligible ? (
                        <span className="text-xs text-green-600">Eligible</span>
                      ) : (
                        <span className="text-xs text-destructive">{c.ineligible_reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sotmCandidates.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No active staff to consider.</div>
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

            <div className="pt-3 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-1">Leaderboard style</label>
              <select
                value={settings?.leaderboard_style ?? "by_tier"}
                onChange={(e) => handleUpdateSettings({ leaderboardStyle: e.target.value as LeaderboardStyle })}
                className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                {LEADERBOARD_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-foreground">Star of the Month</div>
              <button
                onClick={() => handleUpdateSettings({ sotmEnabled: !settings?.sotm_enabled })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  settings?.sotm_enabled
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {settings?.sotm_enabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            {settings?.sotm_enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Criteria</label>
                  <select
                    value={settings.sotm_criteria}
                    onChange={(e) => handleUpdateSettings({ sotmCriteria: e.target.value as SotmCriteria })}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  >
                    {SOTM_CRITERIA.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Minimum star tier (display order, 0 = none)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={settings.sotm_min_star_tier}
                    onBlur={(e) => {
                      const v = sanitizeIntegerInput(e.target.value);
                      handleUpdateSettings({ sotmMinStarTier: v === "" ? 0 : Number(v) });
                    }}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Winner count</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={settings.sotm_winner_count}
                    onBlur={(e) => {
                      const v = sanitizeIntegerInput(e.target.value);
                      handleUpdateSettings({ sotmWinnerCount: v === "" ? 1 : Number(v) });
                    }}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prize amount (₦) — flows to Payroll</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={settings.sotm_prize_amount}
                    onBlur={(e) => {
                      const v = sanitizeDecimalInput(e.target.value);
                      handleUpdateSettings({ sotmPrizeAmount: v === "" ? 0 : Number(v) });
                    }}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={settings.sotm_strike_disqualifies}
                    onChange={(e) => handleUpdateSettings({ sotmStrikeDisqualifies: e.target.checked })}
                  />
                  An active (uncleared) strike disqualifies someone from Star of the Month
                </label>
              </div>
            )}
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
              <label className="block text-sm text-muted-foreground mb-1">Tier</label>
              <select
                value={awardTierId}
                onChange={(e) => setAwardTierId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="">Select tier...</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {awardTierId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tiers.find((t) => t.id === awardTierId)?.criteria || "No criteria set for this tier."}
                </p>
              )}
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
                disabled={!awardStaffId || !awardTierId || !awardReason.trim()}
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
