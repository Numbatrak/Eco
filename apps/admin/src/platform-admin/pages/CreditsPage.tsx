import { useCallback, useEffect, useState } from "react";
import type {
  CreditPricing,
  CreditBundle,
  CreditConsumptionResponse,
  CreditMarginResponse,
  CreditTypeValue,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

type SubTab = "pricing" | "consumption" | "margin";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "pricing", label: "Pricing & Bundles" },
  { key: "consumption", label: "Consumption" },
  { key: "margin", label: "Margin" },
];

export default function CreditsPage(): React.ReactElement {
  const [tab, setTab] = useState<SubTab>("pricing");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Credits</h1>
      </div>

      <div className="pa-tabs">
        {SUB_TABS.map((t) => (
          <button key={t.key} type="button" className={`pa-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {tab === "pricing" ? <PricingView setError={setError} /> : null}
      {tab === "consumption" ? <ConsumptionView setError={setError} /> : null}
      {tab === "margin" ? <MarginView setError={setError} /> : null}
    </div>
  );
}

// ---------- Pricing & Bundles ----------

function PricingView({ setError }: { setError: (s: string | null) => void }): React.ReactElement {
  const [pricing, setPricing] = useState<CreditPricing[]>([]);
  const [bundles, setBundles] = useState<CreditBundle[]>([]);
  const [editType, setEditType] = useState<CreditTypeValue | null>(null);
  const [sellInput, setSellInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundleType, setBundleType] = useState<CreditTypeValue>("email");
  const [bundleUnits, setBundleUnits] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");

  const loadAll = useCallback(() => {
    platformAdminApi.getCreditPricing().then((r) => setPricing(r.pricing)).catch(() => setError("Could not load pricing."));
    platformAdminApi.getCreditBundles().then((r) => setBundles(r.bundles)).catch(() => setError("Could not load bundles."));
  }, [setError]);

  useEffect(loadAll, [loadAll]);

  function startEdit(p: CreditPricing): void {
    setEditType(p.creditType);
    setSellInput(String(p.sellPriceCents));
    setCostInput(String(p.providerCostCents));
  }

  function savePrice(): void {
    if (!editType) return;
    const sell = Number(sellInput);
    const cost = Number(costInput);
    if (isNaN(sell) || isNaN(cost) || sell < 0 || cost < 0) {
      setError("Prices must be non-negative integers (in kobo).");
      return;
    }
    setError(null);
    platformAdminApi
      .setCreditPricing({ creditType: editType, sellPriceCents: sell, providerCostCents: cost })
      .then((r) => {
        setPricing(r.pricing);
        setEditType(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to save pricing."));
  }

  function submitBundle(): void {
    const units = Number(bundleUnits);
    const price = Number(bundlePrice);
    if (!bundleName.trim() || isNaN(units) || units <= 0 || isNaN(price) || price <= 0) {
      setError("All bundle fields are required and must be positive.");
      return;
    }
    setError(null);
    platformAdminApi
      .createCreditBundle({ creditType: bundleType, name: bundleName.trim(), units, priceCents: price })
      .then(() => {
        setShowBundleForm(false);
        setBundleName("");
        setBundleUnits("");
        setBundlePrice("");
        loadAll();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to create bundle."));
  }

  function removeBundle(id: string): void {
    setError(null);
    platformAdminApi
      .deleteCreditBundle(id)
      .then(loadAll)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to delete bundle."));
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Per-unit pricing</h2>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Prices are in kobo (minor units). Changes apply to new purchases only.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Credit type</th>
              <th>Sell price</th>
              <th>Provider cost</th>
              <th>Margin / unit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pricing.map((p) => (
              <tr key={p.creditType}>
                <td style={{ textTransform: "capitalize" }}>{p.creditType}</td>
                {editType === p.creditType ? (
                  <>
                    <td>
                      <input className="text-input" style={{ width: 100 }} value={sellInput} onChange={(e) => setSellInput(e.target.value)} />
                    </td>
                    <td>
                      <input className="text-input" style={{ width: 100 }} value={costInput} onChange={(e) => setCostInput(e.target.value)} />
                    </td>
                    <td className="pa-numeric">—</td>
                    <td>
                      <button type="button" className="btn btn-primary" onClick={savePrice}>Save</button>{" "}
                      <button type="button" className="btn btn-secondary" onClick={() => setEditType(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="pa-numeric">{formatCents(p.sellPriceCents)}</td>
                    <td className="pa-numeric">{formatCents(p.providerCostCents)}</td>
                    <td className="pa-numeric">{formatCents(p.sellPriceCents - p.providerCostCents)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary" onClick={() => startEdit(p)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: "24px 0 12px" }}>Volume bundles</h2>
      <button type="button" className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => setShowBundleForm(true)}>
        + New bundle
      </button>

      {showBundleForm ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field-hint">
              Type
              <select className="text-input" value={bundleType} onChange={(e) => setBundleType(e.target.value as CreditTypeValue)}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label className="field-hint">
              Name
              <input className="text-input" value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. Starter Pack" />
            </label>
            <label className="field-hint">
              Units
              <input className="text-input" type="number" style={{ width: 90 }} value={bundleUnits} onChange={(e) => setBundleUnits(e.target.value)} />
            </label>
            <label className="field-hint">
              Price (kobo)
              <input className="text-input" type="number" style={{ width: 100 }} value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" onClick={submitBundle}>Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowBundleForm(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Units</th>
              <th>Total price</th>
              <th>Per unit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id}>
                <td style={{ textTransform: "capitalize" }}>{b.creditType}</td>
                <td>{b.name}</td>
                <td className="pa-numeric">{b.units.toLocaleString()}</td>
                <td className="pa-numeric">{formatCents(b.priceCents)}</td>
                <td className="pa-numeric">{formatCents(b.perUnitCents)}</td>
                <td>
                  <button type="button" className="btn btn-danger" onClick={() => removeBundle(b.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {bundles.length === 0 ? (
              <tr>
                <td colSpan={6} className="field-hint">No bundles configured.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Consumption ----------

function ConsumptionView({ setError }: { setError: (s: string | null) => void }): React.ReactElement {
  const [data, setData] = useState<CreditConsumptionResponse | null>(null);

  useEffect(() => {
    platformAdminApi.getCreditConsumption().then(setData).catch(() => setError("Could not load consumption data."));
  }, [setError]);

  if (!data) return <div className="field-hint">Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Platform totals</h2>
      <div className="pa-kpi-grid">
        {data.totals.map((t) => (
          <div key={t.creditType} className="pa-kpi-card">
            <div className="pa-kpi-label" style={{ textTransform: "capitalize" }}>{t.creditType}</div>
            <div style={{ fontSize: 13 }}>
              <div>Sold: <strong>{t.soldUnits.toLocaleString()}</strong></div>
              <div>Granted: <strong>{t.grantedUnits.toLocaleString()}</strong></div>
              <div>Consumed: <strong>{t.consumedUnits.toLocaleString()}</strong></div>
              <div>Remaining: <strong>{t.remainingUnits.toLocaleString()}</strong></div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "24px 0 12px" }}>Per-tenant breakdown</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Email remaining</th>
              <th>Email consumed</th>
              <th>WhatsApp remaining</th>
              <th>WhatsApp consumed</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.organizationId}>
                <td>{t.tenantName ?? t.organizationId}</td>
                <td className="pa-numeric">{t.emailRemaining.toLocaleString()}</td>
                <td className="pa-numeric">{t.emailConsumed.toLocaleString()}</td>
                <td className="pa-numeric">{t.whatsappRemaining.toLocaleString()}</td>
                <td className="pa-numeric">{t.whatsappConsumed.toLocaleString()}</td>
              </tr>
            ))}
            {data.tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="field-hint">No tenant credit activity yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Margin ----------

function MarginView({ setError }: { setError: (s: string | null) => void }): React.ReactElement {
  const [data, setData] = useState<CreditMarginResponse | null>(null);

  useEffect(() => {
    platformAdminApi.getCreditMargin().then(setData).catch(() => setError("Could not load margin data."));
  }, [setError]);

  if (!data) return <div className="field-hint">Loading...</div>;

  return (
    <div>
      <div className="pa-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="pa-kpi-card">
          <div className="pa-kpi-label">Aggregate margin</div>
          <div className="pa-kpi-value">{formatCents(data.aggregateMarginCents)}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Credit type</th>
              <th>Sell price</th>
              <th>Provider cost</th>
              <th>Margin / unit</th>
              <th>Units sold</th>
              <th>Total margin</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.creditType}>
                <td style={{ textTransform: "capitalize" }}>{r.creditType}</td>
                <td className="pa-numeric">{formatCents(r.sellPriceCents)}</td>
                <td className="pa-numeric">{formatCents(r.providerCostCents)}</td>
                <td className="pa-numeric">{formatCents(r.marginPerUnitCents)}</td>
                <td className="pa-numeric">{r.soldUnits.toLocaleString()}</td>
                <td className="pa-numeric">{formatCents(r.totalMarginCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
