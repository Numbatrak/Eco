import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchMediaBuyerSettings,
  updateMediaBuyerSettings,
  fetchContractors,
  createContractor,
  deleteContractor,
  fetchBatches,
  createBatch,
  markBatchDone,
  fetchPayments,
  fetchAds,
  fetchSpend,
  createSpend,
  deleteSpend,
  fetchTargets,
  upsertTarget,
  deleteTarget,
  fetchReviews,
  createReview,
  fetchAnalytics,
  type MediaBuyerSettings,
  type Contractor,
  type ProductionBatch,
  type ContractorPayment,
  type AdCatalogEntry,
  type AdSpendEntry,
  type CpaTarget,
  type WeeklyReview,
  type PerformanceAnalytics,
} from "../../services/mediaBuyers";
import { Trash2, Plus, Check, TrendingUp, Film, DollarSign, Target, FileText, BarChart3 } from "lucide-react";

type Tab = "production" | "contractors" | "payments" | "ads" | "spend" | "targets" | "reviews" | "analytics";

export function MediaBuyersPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("mediaBuyers", "canUpdate");

  const [tab, setTab] = useState<Tab>("production");
  const [settings, setSettings] = useState<MediaBuyerSettings | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [payments, setPayments] = useState<ContractorPayment[]>([]);
  const [ads, setAds] = useState<AdCatalogEntry[]>([]);
  const [spend, setSpend] = useState<AdSpendEntry[]>([]);
  const [targets, setTargets] = useState<CpaTarget[]>([]);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, c, b, p, a, sp, t, r, an] = await Promise.all([
        fetchMediaBuyerSettings(),
        fetchContractors(),
        fetchBatches(),
        fetchPayments(),
        fetchAds(),
        fetchSpend(),
        fetchTargets(),
        fetchReviews(),
        fetchAnalytics(),
      ]);
      setSettings(s);
      setContractors(c);
      setBatches(b);
      setPayments(p);
      setAds(a);
      setSpend(sp);
      setTargets(t);
      setReviews(r);
      setAnalytics(an);
    } catch (err) {
      console.error("Failed to load media buyers data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { void load(); }, [load]);

  // --- Add contractor form state ---
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("vo_artist");
  const [newRate, setNewRate] = useState(0);

  // --- Add batch form state ---
  const [batchType, setBatchType] = useState("voiceover");
  const [batchCount, setBatchCount] = useState(1);
  const [batchBrand, setBatchBrand] = useState("");

  // --- Add spend form state ---
  const [spendDate, setSpendDate] = useState("");
  const [spendAmount, setSpendAmount] = useState(0);
  const [spendOrders, setSpendOrders] = useState(0);
  const [spendPlatform, setSpendPlatform] = useState("");

  // --- Add target form state ---
  const [targetCpa, setTargetCpa] = useState(0);
  const [targetBudget, setTargetBudget] = useState(0);

  // --- Add review form state ---
  const [reviewWeekStart, setReviewWeekStart] = useState("");
  const [reviewVerdict, setReviewVerdict] = useState("on_track");
  const [reviewBiggestWin, setReviewBiggestWin] = useState("");

  const tabs: { key: Tab; label: string; icon: typeof Film }[] = [
    { key: "production", label: "Production", icon: Film },
    { key: "contractors", label: "Team", icon: DollarSign },
    { key: "payments", label: "Payments", icon: DollarSign },
    { key: "ads", label: "Ad Catalog", icon: FileText },
    { key: "spend", label: "Spend", icon: TrendingUp },
    { key: "targets", label: "Targets", icon: Target },
    { key: "reviews", label: "Reviews", icon: FileText },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <PageLayout>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Media Buyers</h1>
        <p className="text-sm text-muted-foreground">Creative production, spend tracking, and performance analytics</p>
      </div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-12">Loading...</div>
      ) : (
        <>
          {/* Settings toggle */}
          {canManage && settings && (
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Weekly Reviews</label>
              <button
                onClick={async () => {
                  const updated = await updateMediaBuyerSettings(!settings.weekly_review_enabled);
                  setSettings(updated);
                }}
                className={`px-3 py-1 text-xs rounded ${settings.weekly_review_enabled ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}
              >
                {settings.weekly_review_enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          )}

          {/* Production Batches */}
          {tab === "production" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Production Batches</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <select value={batchType} onChange={(e) => setBatchType(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="voiceover">Voiceover</option>
                    <option value="ugc">UGC</option>
                    <option value="ai_story">AI Story</option>
                    <option value="sound">Sound</option>
                    <option value="other">Other</option>
                  </select>
                  <input type="number" placeholder="Videos" value={batchCount} onChange={(e) => setBatchCount(Number(e.target.value))} className="w-20 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={1} />
                  <input type="text" placeholder="Brand" value={batchBrand} onChange={(e) => setBatchBrand(e.target.value)} className="w-32 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => {
                      await createBatch({ creativeType: batchType, videoCount: batchCount, brand: batchBrand || null });
                      void load();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add Batch
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Type</th><th className="text-left py-2 px-2">Brand</th><th className="text-left py-2 px-2">Videos</th><th className="text-left py-2 px-2">Status</th><th className="text-left py-2 px-2">VO Artist</th><th className="text-left py-2 px-2">Editor</th>{canManage && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{b.creative_type}</td>
                        <td className="py-2 px-2 text-foreground">{b.brand ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{b.video_count}</td>
                        <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-xs ${b.status === "done" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}`}>{b.status}</span></td>
                        <td className="py-2 px-2 text-foreground">{b.vo_artist_name ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{b.editor_name ?? "—"}</td>
                        {canManage && <td className="py-2 px-2">{b.status !== "done" && <button onClick={async () => { await markBatchDone(b.id); void load(); }} className="text-green-600 hover:text-green-800"><Check size={14} /></button>}</td>}
                      </tr>
                    ))}
                    {batches.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No batches yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contractors */}
          {tab === "contractors" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Team (Contractors)</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-40 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="vo_artist">VO Artist</option>
                    <option value="video_editor">Video Editor</option>
                  </select>
                  <input type="number" placeholder="Rate" value={newRate || ""} onChange={(e) => setNewRate(Number(e.target.value))} className="w-24 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={0} />
                  <button
                    onClick={async () => { if (!newName) return; await createContractor(newName, newRole, newRate); setNewName(""); setNewRate(0); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Role</th><th className="text-right py-2 px-2">Rate</th><th className="text-right py-2 px-2">Done</th><th className="text-right py-2 px-2">Paid</th><th className="text-right py-2 px-2">Unpaid</th><th className="text-right py-2 px-2">Owed</th>{canManage && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {contractors.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{c.name}</td>
                        <td className="py-2 px-2 text-foreground">{c.role === "vo_artist" ? "VO Artist" : "Editor"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.rate.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.pieces_done}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.pieces_paid}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.pieces_unpaid}</td>
                        <td className="py-2 px-2 text-right text-foreground font-medium">{c.amount_owed.toLocaleString()}</td>
                        {canManage && <td className="py-2 px-2"><button onClick={async () => { await deleteContractor(c.id); void load(); }} className="text-destructive hover:text-destructive/80"><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                    {contractors.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No contractors yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments */}
          {tab === "payments" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Contractor Payments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Contractor</th><th className="text-right py-2 px-2">Pieces</th><th className="text-right py-2 px-2">Amount</th><th className="text-left py-2 px-2">Brand</th><th className="text-left py-2 px-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{p.contractor_name ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{p.pieces}</td>
                        <td className="py-2 px-2 text-right text-foreground">{p.amount.toLocaleString()}</td>
                        <td className="py-2 px-2 text-foreground">{p.brand ?? "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No payments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ad Catalog */}
          {tab === "ads" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Ad Catalog</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Type</th><th className="text-left py-2 px-2">Brand</th><th className="text-left py-2 px-2">Editor</th><th className="text-left py-2 px-2">Drive</th>
                  </tr></thead>
                  <tbody>
                    {ads.map((a) => (
                      <tr key={a.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{a.name}</td>
                        <td className="py-2 px-2 text-foreground">{a.creative_type ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{a.brand ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{a.editor_name ?? "—"}</td>
                        <td className="py-2 px-2">{a.drive_link ? <a href={a.drive_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Link</a> : "—"}</td>
                      </tr>
                    ))}
                    {ads.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No ads yet — mark a batch as Done to auto-populate</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Spend */}
          {tab === "spend" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Ad Spend</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="date" value={spendDate} onChange={(e) => setSpendDate(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <input type="number" placeholder="Spend" value={spendAmount || ""} onChange={(e) => setSpendAmount(Number(e.target.value))} className="w-28 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={0} />
                  <input type="number" placeholder="Orders" value={spendOrders || ""} onChange={(e) => setSpendOrders(Number(e.target.value))} className="w-24 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={0} />
                  <input type="text" placeholder="Platform" value={spendPlatform} onChange={(e) => setSpendPlatform(e.target.value)} className="w-28 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (!spendDate) return; await createSpend({ spendDate, spend: spendAmount, orders: spendOrders, platform: spendPlatform || null }); setSpendDate(""); setSpendAmount(0); setSpendOrders(0); setSpendPlatform(""); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Date</th><th className="text-left py-2 px-2">Platform</th><th className="text-right py-2 px-2">Spend</th><th className="text-right py-2 px-2">Orders</th><th className="text-right py-2 px-2">CPA</th>{canManage && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {spend.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{s.spend_date}</td>
                        <td className="py-2 px-2 text-foreground">{s.platform ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{s.spend.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-foreground">{s.orders}</td>
                        <td className="py-2 px-2 text-right text-foreground">{s.cpa.toFixed(2)}</td>
                        {canManage && <td className="py-2 px-2"><button onClick={async () => { await deleteSpend(s.id); void load(); }} className="text-destructive hover:text-destructive/80"><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                    {spend.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No spend entries yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Targets */}
          {tab === "targets" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">CPA Targets & Budgets</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="number" placeholder="CPA Target" value={targetCpa || ""} onChange={(e) => setTargetCpa(Number(e.target.value))} className="w-28 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={0} />
                  <input type="number" placeholder="Weekly Budget" value={targetBudget || ""} onChange={(e) => setTargetBudget(Number(e.target.value))} className="w-32 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" min={0} />
                  <button
                    onClick={async () => { await upsertTarget({ cpaTarget: targetCpa, weeklyBudget: targetBudget }); setTargetCpa(0); setTargetBudget(0); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Set Target
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Buyer</th><th className="text-left py-2 px-2">Brand</th><th className="text-right py-2 px-2">CPA Target</th><th className="text-right py-2 px-2">Weekly Budget</th>{canManage && <th className="py-2 px-2"></th>}
                  </tr></thead>
                  <tbody>
                    {targets.map((t) => (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{t.buyer_name ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{t.brand ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{t.cpa_target.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-foreground">{t.weekly_budget.toLocaleString()}</td>
                        {canManage && <td className="py-2 px-2"><button onClick={async () => { await deleteTarget(t.id); void load(); }} className="text-destructive hover:text-destructive/80"><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                    {targets.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No targets set</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reviews */}
          {tab === "reviews" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Weekly Reviews</h3>
              {canManage && settings?.weekly_review_enabled && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="date" value={reviewWeekStart} onChange={(e) => setReviewWeekStart(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <select value={reviewVerdict} onChange={(e) => setReviewVerdict(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="on_track">On Track</option>
                    <option value="needs_attention">Needs Attention</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input type="text" placeholder="Biggest Win" value={reviewBiggestWin} onChange={(e) => setReviewBiggestWin(e.target.value)} className="w-40 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (!reviewWeekStart) return; await createReview({ weekStart: reviewWeekStart, verdict: reviewVerdict, biggestWin: reviewBiggestWin || null }); setReviewWeekStart(""); setReviewBiggestWin(""); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add Review
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="p-4 border border-border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Week of {r.week_start}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${r.verdict === "on_track" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : r.verdict === "needs_attention" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>{r.verdict.replace(/_/g, " ")}</span>
                    </div>
                    {r.biggest_win && <p className="text-sm text-foreground"><strong>Win:</strong> {r.biggest_win}</p>}
                    {r.biggest_issue && <p className="text-sm text-foreground"><strong>Issue:</strong> {r.biggest_issue}</p>}
                  </div>
                ))}
                {reviews.length === 0 && <div className="py-8 text-center text-muted-foreground">No reviews yet</div>}
              </div>
            </div>
          )}

          {/* Analytics */}
          {tab === "analytics" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Performance Analytics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Brand</th><th className="text-left py-2 px-2">Platform</th><th className="text-left py-2 px-2">Buyer</th><th className="text-right py-2 px-2">Spend</th><th className="text-right py-2 px-2">Orders</th><th className="text-right py-2 px-2">CPA</th><th className="text-right py-2 px-2">ROAS</th>
                  </tr></thead>
                  <tbody>
                    {analytics.map((a, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{a.brand ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{a.platform ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{a.buyer_name ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{a.total_spend.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-foreground">{a.total_orders}</td>
                        <td className="py-2 px-2 text-right text-foreground">{a.cpa.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-foreground">{a.roas.toFixed(2)}</td>
                      </tr>
                    ))}
                    {analytics.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No data yet — add spend entries to see analytics</td></tr>}
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
