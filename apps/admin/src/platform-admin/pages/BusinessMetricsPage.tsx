import { useCallback, useEffect, useState } from "react";
import type {
  PnlResponse,
  Expense,
  ExpenseSubCategory,
  ExpenseParentCategory,
  AdPerformanceResponse,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

type SubTab = "pnl" | "expenses" | "ad-performance";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "pnl", label: "P&L" },
  { key: "expenses", label: "Expenses" },
  { key: "ad-performance", label: "Ad Performance" },
];

const PARENT_CATEGORIES: ExpenseParentCategory[] = ["advertising", "marketing", "building", "operational"];

function isoStartOfDay(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function isoEndOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}
function defaultDateInput(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function BusinessMetricsPage(): React.ReactElement {
  const [tab, setTab] = useState<SubTab>("pnl");
  const [fromInput, setFromInput] = useState(() => defaultDateInput(30));
  const [toInput, setToInput] = useState(() => defaultDateInput(0));
  const [error, setError] = useState<string | null>(null);

  const range = { from: isoStartOfDay(fromInput), to: isoEndOfDay(toInput) };

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Business Numbers</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="field-hint" htmlFor="bm-from">From</label>
          <input id="bm-from" type="date" className="text-input" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
          <label className="field-hint" htmlFor="bm-to">To</label>
          <input id="bm-to" type="date" className="text-input" value={toInput} onChange={(e) => setToInput(e.target.value)} />
        </div>
      </div>

      <div className="pa-tabs">
        {SUB_TABS.map((t) => (
          <button key={t.key} type="button" className={`pa-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">{error}</div>
      ) : null}

      {tab === "pnl" ? <PnlView range={range} setError={setError} /> : null}
      {tab === "expenses" ? <ExpensesView range={range} setError={setError} /> : null}
      {tab === "ad-performance" ? <AdPerformanceView range={range} setError={setError} /> : null}
    </div>
  );
}

interface Range { from: string; to: string }

// ---------- P&L ----------

function PnlView({ range, setError }: { range: Range; setError: (s: string | null) => void }): React.ReactElement {
  const [data, setData] = useState<PnlResponse | null>(null);

  useEffect(() => {
    platformAdminApi.getPnl({ from: range.from, to: range.to }).then(setData).catch(() => setError("Could not load P&L."));
  }, [range.from, range.to, setError]);

  if (!data) return <div className="field-hint">Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Income</h2>
      <div className="pa-kpi-grid">
        <Stat label="Subscription revenue (net)" value={formatCents(data.subscriptionRevenueCents)} />
        <Stat label="Credit margin" value={formatCents(data.creditMarginCents)} />
        <Stat label="Total revenue" value={formatCents(data.totalRevenueCents)} />
      </div>

      <h2 style={{ margin: "24px 0 12px" }}>Expenses by category</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total</th>
              <th>% of revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.expensesByCategory.map((e) => (
              <tr key={e.parentCategory}>
                <td style={{ textTransform: "capitalize" }}>{e.parentCategory}</td>
                <td className="pa-numeric">{formatCents(e.totalCents)}</td>
                <td className="pa-numeric">{e.pctOfRevenue !== null ? `${e.pctOfRevenue.toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pa-kpi-grid" style={{ marginTop: 16 }}>
        <Stat label="Total expenses" value={formatCents(data.totalExpensesCents)} />
        <Stat label="Net profit" value={formatCents(data.netProfitCents)} />
      </div>
    </div>
  );
}

// ---------- Expenses ----------

function ExpensesView({ range, setError }: { range: Range; setError: (s: string | null) => void }): React.ReactElement {
  const [rows, setRows] = useState<Expense[]>([]);
  const [subCats, setSubCats] = useState<ExpenseSubCategory[]>([]);
  const [catFilter, setCatFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showSubCatForm, setShowSubCatForm] = useState(false);

  // form fields
  const [formCat, setFormCat] = useState<ExpenseParentCategory>("operational");
  const [formSubCat, setFormSubCat] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSubCatParent, setNewSubCatParent] = useState<ExpenseParentCategory>("operational");
  const [newSubCatName, setNewSubCatName] = useState("");

  const load = useCallback(() => {
    platformAdminApi
      .getExpenses({ from: range.from, to: range.to, category: (catFilter || undefined) as ExpenseParentCategory | undefined })
      .then((res) => { setRows(res.expenses); setSubCats(res.subCategories); })
      .catch(() => setError("Could not load expenses."));
  }, [range.from, range.to, catFilter, setError]);

  useEffect(load, [load]);

  function submitExpense(): void {
    const amount = Number(formAmount);
    if (!formDesc.trim() || isNaN(amount) || amount <= 0) {
      setError("Description and a positive amount are required.");
      return;
    }
    setError(null);
    platformAdminApi
      .createExpense({
        parentCategory: formCat,
        subCategoryId: formSubCat || undefined,
        description: formDesc.trim(),
        amountCents: amount,
        occurredAt: new Date(`${formDate}T12:00:00.000Z`).toISOString(),
      })
      .then(() => { setShowForm(false); setFormDesc(""); setFormAmount(""); load(); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to record expense."));
  }

  function submitSubCat(): void {
    if (!newSubCatName.trim()) { setError("Sub-category name is required."); return; }
    setError(null);
    platformAdminApi
      .createExpenseSubCategory({ parentCategory: newSubCatParent, name: newSubCatName.trim() })
      .then(() => { setShowSubCatForm(false); setNewSubCatName(""); load(); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to create sub-category."));
  }

  function remove(id: string): void {
    setError(null);
    platformAdminApi.deleteExpense(id).then(load).catch((e) => setError(e instanceof ApiError ? e.message : "Failed to delete expense."));
  }

  const filteredSubCats = subCats.filter((s) => s.parentCategory === formCat);

  return (
    <div>
      <div className="pa-filter-bar" style={{ marginBottom: 12 }}>
        <label className="field-hint">
          Category
          <select className="text-input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">All</option>
            {PARENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>+ Record expense</button>
        <button type="button" className="btn btn-secondary" onClick={() => setShowSubCatForm(true)}>+ Sub-category</button>
      </div>

      {showSubCatForm ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field-hint">
              Parent
              <select className="text-input" value={newSubCatParent} onChange={(e) => setNewSubCatParent(e.target.value as ExpenseParentCategory)}>
                {PARENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field-hint">
              Name
              <input className="text-input" value={newSubCatName} onChange={(e) => setNewSubCatName(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" onClick={submitSubCat}>Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowSubCatForm(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field-hint">
              Category
              <select className="text-input" value={formCat} onChange={(e) => { setFormCat(e.target.value as ExpenseParentCategory); setFormSubCat(""); }}>
                {PARENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field-hint">
              Sub-category
              <select className="text-input" value={formSubCat} onChange={(e) => setFormSubCat(e.target.value)}>
                <option value="">None</option>
                {filteredSubCats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field-hint">
              Description
              <input className="text-input" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </label>
            <label className="field-hint">
              Amount (kobo)
              <input className="text-input" type="number" style={{ width: 110 }} value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
            </label>
            <label className="field-hint">
              Date
              <input className="text-input" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" onClick={submitExpense}>Save</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Sub-category</th>
              <th>Description</th>
              <th>Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.occurredAt)}</td>
                <td style={{ textTransform: "capitalize" }}>{e.parentCategory}</td>
                <td>{e.subCategoryName ?? "—"}</td>
                <td>{e.description}</td>
                <td className="pa-numeric">{formatCents(e.amountCents)}</td>
                <td>
                  <button type="button" className="btn btn-danger" onClick={() => remove(e.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="field-hint">No expenses recorded in this range.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Ad Performance ----------

function AdPerformanceView({ range, setError }: { range: Range; setError: (s: string | null) => void }): React.ReactElement {
  const [data, setData] = useState<AdPerformanceResponse | null>(null);

  useEffect(() => {
    platformAdminApi.getAdPerformance({ from: range.from, to: range.to }).then(setData).catch(() => setError("Could not load ad performance."));
  }, [range.from, range.to, setError]);

  if (!data) return <div className="field-hint">Loading...</div>;

  return (
    <div>
      {data.isEarlyEstimate ? (
        <div className="banner" role="status">
          Early estimate — less than 3 months of retention data. LTV projections will stabilise over time.
        </div>
      ) : null}

      <div className="pa-kpi-grid">
        <Stat label="Ad spend" value={formatCents(data.totalAdSpendCents)} />
        <Stat label="Paid conversions" value={data.paidConversions.toLocaleString()} />
        <Stat label="CAC" value={data.cacCents !== null ? formatCents(data.cacCents) : "—"} />
        <Stat label="Actual LTV" value={data.actualLtvCents !== null ? formatCents(data.actualLtvCents) : "—"} />
        <Stat label="LTV:CAC" value={data.ltvToCacRatio !== null ? `${data.ltvToCacRatio}:1` : "—"} />
        <Stat label="Payback (months)" value={data.paybackMonths !== null ? String(data.paybackMonths) : "—"} />
      </div>

      <div className="pa-note" style={{ marginTop: 16 }}>
        CAC uses advertising-category expenses only, divided by new paying customers in the period.
        LTV = ARPU x avg months retained. Payback = CAC / monthly revenue per user.
      </div>
    </div>
  );
}

// ---------- Shared ----------

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="pa-kpi-card">
      <div className="pa-kpi-label">{label}</div>
      <div className="pa-kpi-value">{value}</div>
    </div>
  );
}
