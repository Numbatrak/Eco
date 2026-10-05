import { Fragment, useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchFeedbackSettings,
  updateFeedbackSettings,
  fetchCustomers,
  createCustomer,
  fetchFeedbackCalls,
  fetchComplaints,
  createComplaint,
  escalateComplaint,
  resolveComplaint,
  fetchMorePurchases,
  createMorePurchase,
  fetchCampaigns,
  createCampaign,
  sendCampaign,
  fetchCredits,
  addCredits,
  fetchFeedbackDashboard,
  fetchComplaintDashboard,
  type FeedbackSettings,
  type Customer,
  type FeedbackCall,
  type Complaint,
  type MorePurchase,
  type Campaign,
  type CrmCredit,
  type FeedbackDashboard,
  type ComplaintDashboard,
} from "../../services/crm";
import { Plus, Phone, AlertTriangle, ShoppingBag, Send, CreditCard, BarChart3, Users, ChevronDown, ChevronRight } from "lucide-react";
import { sanitizeIntegerInput } from "../../utils/numericInput";
import { ORDER_STATUS_SELECT_OPTIONS, orderStatusLabel } from "../../constants/orderStatus";
import { fetchCustomerOrderById } from "../../services/ordersV2";
import { fetchProducts } from "../../services/numbatrakProducts";
import { fetchAgents } from "../../services/agents";
import type { Product } from "../../types/product";
import type { Agent } from "../../types/agent";

type Tab = "customers" | "feedback" | "complaints" | "campaigns" | "credits" | "feedback-dashboard" | "complaint-dashboard";

export function CrmPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("crm", "canUpdate");

  const [tab, setTab] = useState<Tab>("customers");
  const [settings, setSettings] = useState<FeedbackSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calls, setCalls] = useState<FeedbackCall[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [purchases, setPurchases] = useState<MorePurchase[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [credits, setCredits] = useState<CrmCredit[]>([]);
  const [feedbackDash, setFeedbackDash] = useState<FeedbackDashboard | null>(null);
  const [complaintDash, setComplaintDash] = useState<ComplaintDashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, cu, ca, co, p, camp, cr, fd, cd, pr, ag] = await Promise.all([
        fetchFeedbackSettings(),
        fetchCustomers(),
        fetchFeedbackCalls(),
        fetchComplaints(),
        fetchMorePurchases(),
        fetchCampaigns(),
        fetchCredits(),
        fetchFeedbackDashboard(),
        fetchComplaintDashboard(),
        fetchProducts(currentOrganization.id, { activeOnly: true }),
        fetchAgents(currentOrganization.id, { activeOnly: true }),
      ]);
      setSettings(s);
      setCustomers(cu);
      setCalls(ca);
      setComplaints(co);
      setPurchases(p);
      setCampaigns(camp);
      setCredits(cr);
      setFeedbackDash(fd);
      setComplaintDash(cd);
      setProducts(pr);
      setAgents(ag);
    } catch (err) {
      console.error("Failed to load CRM data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { void load(); }, [load]);

  const reloadCustomers = useCallback(async (status: string) => {
    try {
      setCustomers(await fetchCustomers(status ? { status } : undefined));
    } catch (err) {
      console.error("Failed to filter customers", err);
    }
  }, []);

  function openResolve(complaint: Complaint) {
    setResolvingComplaintId(complaint.id);
    setResolveResolutionType("other");
    setResolveProductId("");
    setResolveOrderItems(null);
  }

  async function onResolveTypeChange(complaint: Complaint, resolutionType: string) {
    setResolveResolutionType(resolutionType);
    setResolveProductId("");
    if (resolutionType !== "replacement" || !complaint.order_id) {
      setResolveOrderItems(null);
      return;
    }
    const order = await fetchCustomerOrderById(complaint.order_id, currentOrganization?.id ?? null);
    setResolveOrderItems(
      order
        ? order.items.map((item) => {
            const productLabel = order.productNames?.[item.product_id] ?? item.product_id;
            const variantLabel = item.variant_id ? order.variantNames?.[item.variant_id] : null;
            return {
              productId: item.product_id,
              label: variantLabel ? `${productLabel} — ${variantLabel}` : productLabel,
            };
          })
        : [],
    );
  }

  async function submitResolve(complaint: Complaint) {
    if (resolveResolutionType === "replacement" && !resolveProductId) return;
    try {
      await resolveComplaint(complaint.id, {
        resolution: resolveResolutionType === "other" ? "Resolved" : `Resolved via ${resolveResolutionType}`,
        resolutionType: resolveResolutionType,
        productId: resolveResolutionType === "replacement" ? resolveProductId : null,
      });
      setResolvingComplaintId(null);
      void load();
    } catch (err) {
      console.error("Failed to resolve complaint", err);
      alert(err instanceof Error ? err.message : "Failed to resolve complaint");
    }
  }

  // --- Form state ---
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("");
  const [resolvingComplaintId, setResolvingComplaintId] = useState<string | null>(null);
  const [resolveResolutionType, setResolveResolutionType] = useState("other");
  const [resolveProductId, setResolveProductId] = useState("");
  const [resolveOrderItems, setResolveOrderItems] = useState<{ productId: string; label: string }[] | null>(null);
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaintCustId, setComplaintCustId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("email");
  const [campaignBody, setCampaignBody] = useState("");
  const [creditChannel, setCreditChannel] = useState("email");
  const [creditAmount, setCreditAmount] = useState(0);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [mpProductId, setMpProductId] = useState("");
  const [mpAgentId, setMpAgentId] = useState("");
  const [mpQuantity, setMpQuantity] = useState(0);
  const [mpAmount, setMpAmount] = useState(0);
  const [mpDeliveryCost, setMpDeliveryCost] = useState(0);
  const [mpSubmitting, setMpSubmitting] = useState(false);

  function toggleCustomer(customerId: string) {
    setExpandedCustomerId((cur) => (cur === customerId ? null : customerId));
    setMpProductId("");
    setMpAgentId("");
    setMpQuantity(0);
    setMpAmount(0);
    setMpDeliveryCost(0);
  }

  async function submitMorePurchase(customerId: string) {
    if (!mpAmount || mpQuantity < 1) return;
    setMpSubmitting(true);
    try {
      await createMorePurchase({
        customerId,
        productId: mpProductId || null,
        agentId: mpAgentId ? Number(mpAgentId) : null,
        quantity: mpQuantity,
        amount: mpAmount,
        deliveryCost: mpDeliveryCost,
      });
      setMpProductId("");
      setMpAgentId("");
      setMpQuantity(0);
      setMpAmount(0);
      setMpDeliveryCost(0);
      void load();
    } catch (err) {
      console.error("Failed to record more purchase", err);
      alert(err instanceof Error ? err.message : "Failed to record more purchase");
    } finally {
      setMpSubmitting(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "customers", label: "Customers", icon: Users },
    { key: "feedback", label: "Feedback Calls", icon: Phone },
    { key: "complaints", label: "Complaints", icon: AlertTriangle },
    { key: "campaigns", label: "Campaigns", icon: Send },
    { key: "credits", label: "Credits", icon: CreditCard },
    { key: "feedback-dashboard", label: "Feedback Stats", icon: BarChart3 },
    { key: "complaint-dashboard", label: "Complaint Stats", icon: BarChart3 },
  ];

  return (
    <PageLayout>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
        <p className="text-sm text-muted-foreground">Customer database, feedback calls, complaints, and marketing campaigns</p>
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
          {/* Settings */}
          {canManage && settings && (
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Call Window (days)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settings.call_window_days}
                onChange={async (e) => {
                  const v = sanitizeIntegerInput(e.target.value);
                  const updated = await updateFeedbackSettings(v === "" ? 0 : Number(v));
                  setSettings(updated);
                }}
                className="w-16 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              />
            </div>
          )}

          {/* Customers */}
          {tab === "customers" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Customers</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-sm text-muted-foreground">
                  Status
                  <select
                    value={customerStatusFilter}
                    onChange={(e) => { setCustomerStatusFilter(e.target.value); void reloadCustomers(e.target.value); }}
                    className="ml-2 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground"
                  >
                    <option value="">All</option>
                    {ORDER_STATUS_SELECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="text" placeholder="Name" value={custName} onChange={(e) => setCustName(e.target.value)} className="w-40 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <input type="text" placeholder="Phone" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="w-36 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (!custName || !custPhone) return; await createCustomer({ name: custName, phone: custPhone }); setCustName(""); setCustPhone(""); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 w-6"></th><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Phone</th><th className="text-left py-2 px-2">Location</th><th className="text-left py-2 px-2">Status</th><th className="text-left py-2 px-2">First Click</th><th className="text-left py-2 px-2">Last Click</th><th className="text-right py-2 px-2">Order Revenue</th><th className="text-right py-2 px-2">More Purchase Revenue</th><th className="text-right py-2 px-2">Upsell Revenue</th><th className="text-right py-2 px-2">LTV</th><th className="text-right py-2 px-2">Orders</th><th className="text-right py-2 px-2">More Purchases</th>
                  </tr></thead>
                  <tbody>
                    {customers.map((c) => {
                      const isOpen = expandedCustomerId === c.id;
                      const customerPurchases = purchases.filter((p) => p.customer_id === c.id);
                      return (
                        <Fragment key={c.id}>
                          <tr className="border-b border-border/50 cursor-pointer hover:bg-accent/40" onClick={() => toggleCustomer(c.id)}>
                            <td className="py-2 px-2 text-muted-foreground">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                            <td className="py-2 px-2 text-foreground">{c.name}</td>
                            <td className="py-2 px-2 text-foreground">{c.phone}</td>
                            <td className="py-2 px-2 text-foreground">{c.location ?? "—"}</td>
                            <td className="py-2 px-2 text-foreground">{c.latest_order_status ? orderStatusLabel(c.latest_order_status) : "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground">{c.first_click_source ?? "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground">{c.last_click_source ?? "—"}</td>
                            <td className="py-2 px-2 text-right text-foreground">{c.order_revenue.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-foreground">{c.more_purchase_revenue.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-foreground">{c.upsell_revenue.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-foreground font-medium">{c.ltv.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-foreground">{c.order_count}</td>
                            <td className="py-2 px-2 text-right text-foreground">{c.more_purchase_count}</td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-border/50 bg-muted/30">
                              <td colSpan={13} className="py-3 px-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <ShoppingBag size={14} /> More Purchases — {c.name}
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead><tr className="border-b border-border text-muted-foreground">
                                        <th className="text-left py-1 px-2">Product</th><th className="text-right py-1 px-2">Qty</th><th className="text-right py-1 px-2">Amount</th><th className="text-right py-1 px-2">COGS</th><th className="text-right py-1 px-2">Profit</th><th className="text-left py-1 px-2">Status</th>
                                      </tr></thead>
                                      <tbody>
                                        {customerPurchases.map((p) => (
                                          <tr key={p.id} className="border-b border-border/30">
                                            <td className="py-1 px-2 text-foreground">{p.product_name ?? "—"}</td>
                                            <td className="py-1 px-2 text-right text-foreground">{p.quantity}</td>
                                            <td className="py-1 px-2 text-right text-foreground">{p.amount.toLocaleString()}</td>
                                            <td className="py-1 px-2 text-right text-foreground">{p.cogs.toLocaleString()}</td>
                                            <td className="py-1 px-2 text-right text-foreground font-medium">{p.profit.toLocaleString()}</td>
                                            <td className="py-1 px-2 text-foreground">{p.status}</td>
                                          </tr>
                                        ))}
                                        {customerPurchases.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No more purchases yet</td></tr>}
                                      </tbody>
                                    </table>
                                  </div>
                                  {canManage && (
                                    <div className="flex flex-wrap gap-2 items-end bg-background p-2 rounded-lg border border-border" onClick={(e) => e.stopPropagation()}>
                                      <label className="text-xs text-muted-foreground">
                                        Product
                                        <select value={mpProductId} onChange={(e) => setMpProductId(e.target.value)} className="ml-2 px-2 py-1 text-sm border border-border rounded bg-background text-foreground">
                                          <option value="">Freeform (no stock deduction)</option>
                                          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">
                                        Agent
                                        <select value={mpAgentId} onChange={(e) => setMpAgentId(e.target.value)} className="ml-2 px-2 py-1 text-sm border border-border rounded bg-background text-foreground">
                                          <option value="">None</option>
                                          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">
                                        Qty
                                        <input type="text" inputMode="numeric" value={mpQuantity || ""} onChange={(e) => { const v = sanitizeIntegerInput(e.target.value); setMpQuantity(v === "" ? 0 : Number(v)); }} className="ml-2 w-14 px-2 py-1 text-sm border border-border rounded bg-background text-foreground" />
                                      </label>
                                      <label className="text-xs text-muted-foreground">
                                        Amount
                                        <input type="text" inputMode="numeric" value={mpAmount || ""} onChange={(e) => { const v = sanitizeIntegerInput(e.target.value); setMpAmount(v === "" ? 0 : Number(v)); }} className="ml-2 w-24 px-2 py-1 text-sm border border-border rounded bg-background text-foreground" />
                                      </label>
                                      <label className="text-xs text-muted-foreground">
                                        Delivery Cost
                                        <input type="text" inputMode="numeric" value={mpDeliveryCost || ""} onChange={(e) => { const v = sanitizeIntegerInput(e.target.value); setMpDeliveryCost(v === "" ? 0 : Number(v)); }} className="ml-2 w-24 px-2 py-1 text-sm border border-border rounded bg-background text-foreground" />
                                      </label>
                                      <button
                                        disabled={mpSubmitting}
                                        onClick={() => void submitMorePurchase(c.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                                      >
                                        <Plus size={14} /> Record Purchase
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {customers.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-muted-foreground">No customers yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feedback Calls */}
          {tab === "feedback" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Feedback Calls</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Customer</th><th className="text-left py-2 px-2">Phone</th><th className="text-left py-2 px-2">Scheduled</th><th className="text-left py-2 px-2">Disposition</th><th className="text-right py-2 px-2">Score</th><th className="text-right py-2 px-2">Attempts</th>
                  </tr></thead>
                  <tbody>
                    {calls.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{c.customer_name ?? "—"}</td>
                        <td className="py-2 px-2 text-foreground">{c.customer_phone ?? "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground">{new Date(c.scheduled_at).toLocaleDateString()}</td>
                        <td className="py-2 px-2">
                          {c.disposition ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${c.disposition === "answered" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}`}>{c.disposition}</span>
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-foreground">{c.satisfaction_score ?? "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.attempts}</td>
                      </tr>
                    ))}
                    {calls.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No feedback calls yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Complaints */}
          {tab === "complaints" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Complaints</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <select value={complaintCustId} onChange={(e) => setComplaintCustId(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="">Select customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                  <input type="text" placeholder="Description" value={complaintDesc} onChange={(e) => setComplaintDesc(e.target.value)} className="w-60 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (!complaintCustId || !complaintDesc) return; await createComplaint({ customerId: complaintCustId, description: complaintDesc }); setComplaintCustId(""); setComplaintDesc(""); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Customer</th><th className="text-left py-2 px-2">Type</th><th className="text-left py-2 px-2">Description</th><th className="text-left py-2 px-2">Status</th><th className="text-left py-2 px-2">Resolution</th>{canManage && <th className="py-2 px-2">Actions</th>}
                  </tr></thead>
                  <tbody>
                    {complaints.map((c) => (
                      <Fragment key={c.id}>
                        <tr className="border-b border-border/50">
                          <td className="py-2 px-2 text-foreground">{c.customer_name ?? "—"}</td>
                          <td className="py-2 px-2 text-foreground">{c.complaint_type ?? "—"}</td>
                          <td className="py-2 px-2 text-foreground max-w-xs truncate">{c.description}</td>
                          <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-xs ${c.status === "resolved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : c.status === "escalated" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}`}>{c.status}</span></td>
                          <td className="py-2 px-2 text-foreground">{c.resolution_type ?? "—"}</td>
                          {canManage && (
                            <td className="py-2 px-2 flex gap-1">
                              {c.status === "open" && <button onClick={async () => { await escalateComplaint(c.id); void load(); }} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded dark:bg-red-900 dark:text-red-200">Escalate</button>}
                              {c.status !== "resolved" && resolvingComplaintId !== c.id && <button onClick={() => openResolve(c)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded dark:bg-green-900 dark:text-green-200">Resolve</button>}
                            </td>
                          )}
                        </tr>
                        {resolvingComplaintId === c.id && (
                          <tr className="border-b border-border/50 bg-muted/30">
                            <td colSpan={6} className="py-2 px-2">
                              <div className="flex flex-wrap gap-2 items-end">
                                <label className="text-xs text-muted-foreground">
                                  Resolution
                                  <select
                                    value={resolveResolutionType}
                                    onChange={(e) => void onResolveTypeChange(c, e.target.value)}
                                    className="ml-2 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                                  >
                                    <option value="other">Other</option>
                                    <option value="refund">Refund</option>
                                    <option value="replacement">Replacement</option>
                                  </select>
                                </label>
                                {resolveResolutionType === "refund" && !c.order_id && (
                                  <span className="text-xs text-red-600 dark:text-red-400">This complaint isn't linked to an order — a refund needs one.</span>
                                )}
                                {resolveResolutionType === "replacement" && (
                                  !c.order_id ? (
                                    <span className="text-xs text-red-600 dark:text-red-400">This complaint isn't linked to an order — a replacement needs one.</span>
                                  ) : (
                                    <label className="text-xs text-muted-foreground">
                                      Product
                                      <select
                                        value={resolveProductId}
                                        onChange={(e) => setResolveProductId(e.target.value)}
                                        className="ml-2 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                                      >
                                        <option value="">{resolveOrderItems === null ? "Loading…" : "Select product..."}</option>
                                        {resolveOrderItems?.map((item) => (
                                          <option key={item.productId} value={item.productId}>{item.label}</option>
                                        ))}
                                      </select>
                                    </label>
                                  )
                                )}
                                <button
                                  onClick={() => void submitResolve(c)}
                                  disabled={(resolveResolutionType === "refund" && !c.order_id) || (resolveResolutionType === "replacement" && (!c.order_id || !resolveProductId))}
                                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button onClick={() => setResolvingComplaintId(null)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {complaints.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No complaints yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Campaigns */}
          {tab === "campaigns" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Campaigns</h3>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <input type="text" placeholder="Campaign name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-40 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <select value={campaignChannel} onChange={(e) => setCampaignChannel(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <input type="text" placeholder="Message body" value={campaignBody} onChange={(e) => setCampaignBody(e.target.value)} className="w-60 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (!campaignName || !campaignBody) return; await createCampaign({ name: campaignName, channel: campaignChannel, body: campaignBody }); setCampaignName(""); setCampaignBody(""); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Create
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Channel</th><th className="text-left py-2 px-2">Status</th><th className="text-right py-2 px-2">Sent</th><th className="text-right py-2 px-2">Failed</th>{canManage && <th className="py-2 px-2">Actions</th>}
                  </tr></thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{c.name}</td>
                        <td className="py-2 px-2 text-foreground">{c.channel}</td>
                        <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-xs ${c.status === "sent" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : c.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"}`}>{c.status}</span></td>
                        <td className="py-2 px-2 text-right text-foreground">{c.sent_count}</td>
                        <td className="py-2 px-2 text-right text-foreground">{c.failed_count}</td>
                        {canManage && (
                          <td className="py-2 px-2">
                            {c.status === "draft" && <button onClick={async () => { await sendCampaign(c.id); void load(); }} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Send</button>}
                          </td>
                        )}
                      </tr>
                    ))}
                    {campaigns.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No campaigns yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credits */}
          {tab === "credits" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Campaign Credits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {credits.map((c) => (
                  <div key={c.channel} className="p-4 border border-border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground capitalize">{c.channel}</div>
                    <div className="text-2xl font-bold text-foreground">{c.balance.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">credits remaining</div>
                  </div>
                ))}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2 items-end bg-muted/50 p-3 rounded-lg">
                  <select value={creditChannel} onChange={(e) => setCreditChannel(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <input type="text" inputMode="numeric" placeholder="Amount" value={creditAmount || ""} onChange={(e) => { const v = sanitizeIntegerInput(e.target.value); setCreditAmount(v === "" ? 0 : Number(v)); }} className="w-24 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground" />
                  <button
                    onClick={async () => { if (creditAmount <= 0) return; await addCredits(creditChannel, creditAmount); setCreditAmount(0); void load(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <Plus size={14} /> Add Credits
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feedback Dashboard */}
          {tab === "feedback-dashboard" && feedbackDash && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Feedback Dashboard</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "Total Calls", value: feedbackDash.total_calls },
                  { label: "Attempted", value: feedbackDash.attempted },
                  { label: "Answer Rate", value: `${(feedbackDash.answer_rate * 100).toFixed(1)}%` },
                  { label: "Avg Satisfaction", value: feedbackDash.avg_satisfaction.toFixed(1) },
                  { label: "Happy Rate", value: `${(feedbackDash.happy_rate * 100).toFixed(1)}%` },
                  { label: "Unhappy Rate", value: `${(feedbackDash.unhappy_rate * 100).toFixed(1)}%` },
                  { label: "More Purchase Rev", value: feedbackDash.more_purchase_revenue.toLocaleString() },
                  { label: "More Purchase Profit", value: feedbackDash.more_purchase_profit.toLocaleString() },
                  { label: "Profit/Call", value: feedbackDash.profit_per_call.toFixed(2) },
                  { label: "Avg Attempts", value: feedbackDash.avg_attempts_to_reach.toFixed(1) },
                ].map((m) => (
                  <div key={m.label} className="p-3 border border-border rounded-lg bg-card">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-lg font-bold text-foreground">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complaint Dashboard */}
          {tab === "complaint-dashboard" && complaintDash && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Complaint Dashboard</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total", value: complaintDash.total },
                  { label: "Open", value: complaintDash.open },
                  { label: "Escalated", value: complaintDash.escalated },
                  { label: "Resolved", value: complaintDash.resolved },
                  { label: "Resolution Rate", value: `${(complaintDash.resolution_rate * 100).toFixed(1)}%` },
                  { label: "Refunds", value: complaintDash.refund_count },
                  { label: "Replacements", value: complaintDash.replacement_count },
                  { label: "Chargeback Cost", value: complaintDash.chargeback_cost.toLocaleString() },
                ].map((m) => (
                  <div key={m.label} className="p-3 border border-border rounded-lg bg-card">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-lg font-bold text-foreground">{m.value}</div>
                  </div>
                ))}
              </div>
              {complaintDash.by_type.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">By Type</h4>
                  <div className="flex flex-wrap gap-2">
                    {complaintDash.by_type.map((t) => (
                      <div key={t.type} className="px-3 py-2 border border-border rounded-lg bg-card text-sm">
                        <span className="text-muted-foreground">{t.type.replace(/_/g, " ")}:</span> <span className="font-medium text-foreground">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
