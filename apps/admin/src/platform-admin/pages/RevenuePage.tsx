import { useCallback, useEffect, useState } from "react";
import type {
  RevenueTransaction,
  RevenueLedgerQuery,
  FailedPayment,
  TaxViewResponse,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate, formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

type SubTab = "ledger" | "failed" | "tax" | "refunds";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "ledger", label: "Transaction ledger" },
  { key: "failed", label: "Failed payments" },
  { key: "tax", label: "Tax view" },
  { key: "refunds", label: "Refunds" },
];
const PAGE_SIZE = 50;

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

export default function RevenuePage(): React.ReactElement {
  const [tab, setTab] = useState<SubTab>("ledger");
  const [fromInput, setFromInput] = useState(() => defaultDateInput(30));
  const [toInput, setToInput] = useState(() => defaultDateInput(0));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const range = { from: isoStartOfDay(fromInput), to: isoEndOfDay(toInput) };

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Revenue</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="field-hint" htmlFor="rev-from">
            From
          </label>
          <input id="rev-from" type="date" className="text-input" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
          <label className="field-hint" htmlFor="rev-to">
            To
          </label>
          <input id="rev-to" type="date" className="text-input" value={toInput} onChange={(e) => setToInput(e.target.value)} />
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
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="banner" role="status">
          {notice}
        </div>
      ) : null}

      {tab === "ledger" ? (
        <LedgerView range={range} setError={setError} setNotice={setNotice} statusFilter={undefined} showRefund />
      ) : null}
      {tab === "refunds" ? (
        <LedgerView range={range} setError={setError} setNotice={setNotice} statusFilter="refunded" showRefund={false} />
      ) : null}
      {tab === "failed" ? <FailedPaymentsView setError={setError} /> : null}
      {tab === "tax" ? <TaxView range={range} setError={setError} /> : null}
    </div>
  );
}

interface Range {
  from: string;
  to: string;
}

function LedgerView({
  range,
  setError,
  setNotice,
  statusFilter,
  showRefund,
}: {
  range: Range;
  setError: (s: string | null) => void;
  setNotice: (s: string | null) => void;
  statusFilter?: RevenueLedgerQuery["status"];
  showRefund: boolean;
}): React.ReactElement {
  const [type, setType] = useState<"" | "subscription" | "credit_purchase">("");
  const [status, setStatus] = useState<"" | "success" | "failed" | "refunded">("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RevenueTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [refundRef, setRefundRef] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const effectiveStatus = statusFilter ?? (status || undefined);

  const query: RevenueLedgerQuery = {
    page,
    pageSize: PAGE_SIZE,
    type: type || undefined,
    status: effectiveStatus,
    tier: tier || undefined,
    from: range.from,
    to: range.to,
  };

  const load = useCallback(() => {
    platformAdminApi
      .getRevenueLedger(query)
      .then((res) => {
        setRows(res.transactions);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load transactions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, type, status, tier, range.from, range.to, statusFilter]);

  useEffect(load, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function submitRefund(): void {
    if (!refundRef) return;
    setError(null);
    setNotice(null);
    platformAdminApi
      .issueRefund(refundRef, { reason: refundReason.trim() })
      .then(() => {
        setNotice(`Refund issued for ${refundRef}.`);
        setRefundRef(null);
        setRefundReason("");
        load();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Refund failed."));
  }

  return (
    <div>
      <div className="pa-filter-bar">
        {!statusFilter ? (
          <>
            <label className="field-hint">
              Type
              <select className="text-input" value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }}>
                <option value="">All</option>
                <option value="subscription">Subscription</option>
                <option value="credit_purchase">Credit purchase</option>
              </select>
            </label>
            <label className="field-hint">
              Status
              <select className="text-input" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="field-hint">
          Tier
          <select className="text-input" value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="starter">starter</option>
            <option value="growth">growth</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => platformAdminApi.downloadLedgerCsv(query).catch(() => setError("Export failed."))}>
          Export CSV
        </button>
      </div>

      {refundRef ? (
        <div className="panel" style={{ padding: 16, marginBottom: 12, border: "1px solid var(--danger)" }}>
          <div className="pa-kpi-label">Refund {refundRef}</div>
          <p className="field-hint">Processes through Paystack and marks the charge refunded. Reason required.</p>
          <textarea className="text-input" rows={2} placeholder="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-danger" disabled={!refundReason.trim()} onClick={submitRefund}>
              Issue refund
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setRefundRef(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Tenant</th>
              <th>Type</th>
              <th>Tier</th>
              <th>Method</th>
              <th>Amount</th>
              <th>VAT</th>
              <th>Status</th>
              <th>Reference</th>
              {showRefund ? <th /> : null}
              {statusFilter === "refunded" ? <th>Refunded</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.createdAt)}</td>
                <td>{t.tenantName ?? "—"}</td>
                <td>{t.type}</td>
                <td>{t.planTier ?? "—"}</td>
                <td>{t.paymentMethod ?? "—"}</td>
                <td className="pa-numeric">{formatCents(t.amountCents)}</td>
                <td className="pa-numeric">{formatCents(t.vatCents)}</td>
                <td>
                  <span className={`pa-badge pa-badge-${t.status === "success" ? "active" : t.status === "failed" ? "locked" : "cancelled"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="field-hint">{t.paystackReference}</td>
                {showRefund ? (
                  <td>
                    {t.type === "subscription" && t.status === "success" ? (
                      <button type="button" className="btn btn-secondary" onClick={() => { setRefundRef(t.paystackReference); setRefundReason(""); }}>
                        Refund
                      </button>
                    ) : null}
                  </td>
                ) : null}
                {statusFilter === "refunded" ? <td className="field-hint">{t.refundedAt ? formatDateTime(t.refundedAt) : "—"}<br />{t.refundReason}</td> : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="field-hint">
                  No transactions in this range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pa-toolbar">
        <span className="field-hint">
          Page {page} of {totalPages} ({total} total)
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FailedPaymentsView({ setError }: { setError: (s: string | null) => void }): React.ReactElement {
  const [rows, setRows] = useState<FailedPayment[]>([]);
  useEffect(() => {
    platformAdminApi
      .getFailedPayments()
      .then((res) => setRows(res.failedPayments))
      .catch(() => setError("Could not load failed payments."));
  }, [setError]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="pa-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Owner</th>
            <th>Stage</th>
            <th>Grace ends</th>
            <th>Locked at</th>
            <th>Delete after</th>
            <th>Last failed</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.organizationId}>
              <td>{f.tenantName}</td>
              <td>{f.ownerEmail ?? "—"}</td>
              <td>
                <span className={`pa-badge pa-badge-${f.stage === "locked" ? "locked" : "past_due"}`}>{f.stage}</span>
              </td>
              <td>{f.gracePeriodEndsAt ? formatDateTime(f.gracePeriodEndsAt) : "—"}</td>
              <td>{f.lockedAt ? formatDateTime(f.lockedAt) : "—"}</td>
              <td>{f.deleteAfter ? formatDate(f.deleteAfter) : "—"}</td>
              <td className="pa-numeric">
                {f.lastFailedAmountCents !== null ? formatCents(f.lastFailedAmountCents) : "—"}
              </td>
              <td className="field-hint">{f.failureReason ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="field-hint">
                No tenants in the dunning pipeline.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TaxView({ range, setError }: { range: Range; setError: (s: string | null) => void }): React.ReactElement {
  const [tax, setTax] = useState<TaxViewResponse | null>(null);
  useEffect(() => {
    platformAdminApi
      .getTaxView({ from: range.from, to: range.to })
      .then(setTax)
      .catch(() => setError("Could not load the tax view."));
  }, [range.from, range.to, setError]);

  return (
    <div>
      <div className="pa-kpi-grid">
        <Stat label="Gross collected" value={tax ? formatCents(tax.grossCollectedCents) : "—"} />
        <Stat label="VAT collected (7.5%)" value={tax ? formatCents(tax.vatCollectedCents) : "—"} />
        <Stat label="Taxable — subscriptions" value={tax ? formatCents(tax.taxableGrossCents) : "—"} />
        <Stat label="Non-taxable — credits" value={tax ? formatCents(tax.nonTaxableGrossCents) : "—"} />
        <Stat label="Net after VAT" value={tax ? formatCents(tax.netAfterVatCents) : "—"} />
        <Stat label="Refunds issued" value={tax ? `${tax.refundsIssuedCount} · ${formatCents(tax.refundsIssuedCents)}` : "—"} />
      </div>
      <div className="pa-note">VAT is charged on subscriptions only; credit purchases are not VAT-liable.</div>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginTop: 12 }}
        onClick={() => platformAdminApi.downloadTaxCsv({ from: range.from, to: range.to }).catch(() => setError("Export failed."))}
      >
        Export FIRS report (CSV)
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="pa-kpi-card">
      <div className="pa-kpi-label">{label}</div>
      <div className="pa-kpi-value">{value}</div>
    </div>
  );
}
