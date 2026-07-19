import { useCallback, useEffect, useState } from "react";
import type { Affiliate, AffiliateDetail, AffiliatePerformance } from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate, formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

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
function ratePct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export default function AffiliatesPage(): React.ReactElement {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("10");

  const loadList = useCallback(() => {
    platformAdminApi
      .getAffiliates()
      .then((r) => setAffiliates(r.affiliates))
      .catch(() => setError("Could not load affiliates."));
  }, []);

  useEffect(loadList, [loadList]);

  function handleCreate(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    setNotice(null);
    platformAdminApi
      .createAffiliate({ name: name.trim(), email: email.trim() || undefined, commissionRatePct: Number(rate) })
      .then((created) => {
        setNotice(`Created ${created.name} — referral code ${created.code}.`);
        setName("");
        setEmail("");
        setRate("10");
        loadList();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not create affiliate."));
  }

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Affiliates</h1>
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

      <section style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2>Create affiliate</h2>
        <form onSubmit={handleCreate} className="pa-filter-bar">
          <label className="field-hint">
            Name
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field-hint">
            Email (optional)
            <input type="email" className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field-hint">
            Commission %
            <input type="number" className="text-input" value={rate} onChange={(e) => setRate(e.target.value)} min={0} max={100} step={0.5} />
          </label>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </form>
      </section>

      <div style={{ overflowX: "auto" }}>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Referral link</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Signups</th>
              <th>Conversions</th>
              <th>Revenue attributed</th>
              <th>Commission earned</th>
              <th>Owed</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr
                key={a.id}
                onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                style={{ cursor: "pointer", background: a.id === selectedId ? "var(--paper)" : undefined }}
              >
                <td>
                  <span className="pa-table-link">{a.name}</span>
                  <div className="field-hint">{a.email ?? a.code}</div>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard?.writeText(a.referralUrl);
                      setNotice("Referral link copied.");
                    }}
                  >
                    Copy link
                  </button>
                </td>
                <td>{ratePct(a.commissionRateBps)}</td>
                <td>
                  <span className={`pa-badge pa-badge-${a.status === "active" ? "active" : "cancelled"}`}>{a.status}</span>
                </td>
                <td className="pa-numeric">{a.performance.signups}</td>
                <td className="pa-numeric">{a.performance.conversions}</td>
                <td className="pa-numeric">{formatCents(a.performance.revenueAttributedCents)}</td>
                <td className="pa-numeric">{formatCents(a.performance.commissionEarnedCents)}</td>
                <td className="pa-numeric">{formatCents(a.commissionOwedCents)}</td>
              </tr>
            ))}
            {affiliates.length === 0 ? (
              <tr>
                <td colSpan={9} className="field-hint">
                  No affiliates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <AffiliateDetailPanel
          affiliateId={selectedId}
          onChanged={() => {
            loadList();
          }}
          setError={setError}
          setNotice={setNotice}
        />
      ) : null}
    </div>
  );
}

function AffiliateDetailPanel({
  affiliateId,
  onChanged,
  setError,
  setNotice,
}: {
  affiliateId: string;
  onChanged: () => void;
  setError: (s: string | null) => void;
  setNotice: (s: string | null) => void;
}): React.ReactElement {
  const [detail, setDetail] = useState<AffiliateDetail | null>(null);
  const [fromInput, setFromInput] = useState(() => defaultDateInput(30));
  const [toInput, setToInput] = useState(() => defaultDateInput(0));
  const [perf, setPerf] = useState<AffiliatePerformance | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const load = useCallback(() => {
    platformAdminApi.getAffiliate(affiliateId).then(setDetail).catch(() => setError("Could not load affiliate."));
  }, [affiliateId, setError]);

  useEffect(load, [load]);

  useEffect(() => {
    platformAdminApi
      .getAffiliatePerformance(affiliateId, { from: isoStartOfDay(fromInput), to: isoEndOfDay(toInput) })
      .then(setPerf)
      .catch(() => setPerf(null));
  }, [affiliateId, fromInput, toInput]);

  if (!detail) return <p className="field-hint">Loading…</p>;

  function toggleStatus(): void {
    const next = detail!.status === "active" ? "paused" : "active";
    platformAdminApi
      .setAffiliateStatus(affiliateId, { status: next })
      .then(() => {
        load();
        onChanged();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not update status."));
  }

  function submitPayout(e: React.FormEvent): void {
    e.preventDefault();
    const naira = Number(payoutAmount);
    if (!Number.isFinite(naira) || naira <= 0) {
      setError("Enter a positive payout amount.");
      return;
    }
    platformAdminApi
      .recordAffiliatePayout(affiliateId, { amountCents: Math.round(naira * 100), note: payoutNote.trim() || undefined })
      .then(() => {
        setNotice("Payout recorded.");
        setPayoutAmount("");
        setPayoutNote("");
        load();
        onChanged();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not record payout."));
  }

  return (
    <section style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="pa-toolbar">
        <h2>{detail.name}</h2>
        <button type="button" className={detail.status === "active" ? "btn btn-danger" : "btn btn-primary"} onClick={toggleStatus}>
          {detail.status === "active" ? "Pause" : "Activate"}
        </button>
      </div>

      <h3>Performance</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label className="field-hint" htmlFor="aff-from">
          From
        </label>
        <input id="aff-from" type="date" className="text-input" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
        <label className="field-hint" htmlFor="aff-to">
          To
        </label>
        <input id="aff-to" type="date" className="text-input" value={toInput} onChange={(e) => setToInput(e.target.value)} />
      </div>
      <div className="pa-kpi-grid">
        <Stat label="Signups" value={String(perf?.signups ?? "—")} />
        <Stat label="Trials started" value={String(perf?.trialsStarted ?? "—")} />
        <Stat label="Conversions" value={String(perf?.conversions ?? "—")} />
        <Stat label="Revenue attributed" value={perf ? formatCents(perf.revenueAttributedCents) : "—"} />
        <Stat label="Commission earned" value={perf ? formatCents(perf.commissionEarnedCents) : "—"} />
      </div>

      <h3 style={{ marginTop: 16 }}>Payouts</h3>
      <div className="pa-kpi-grid">
        <Stat label="Total paid" value={formatCents(detail.totalPaidCents)} />
        <Stat label="Commission owed (lifetime)" value={formatCents(detail.commissionOwedCents)} />
      </div>
      <form onSubmit={submitPayout} className="pa-filter-bar" style={{ marginTop: 8 }}>
        <label className="field-hint">
          Amount (₦)
          <input type="number" className="text-input" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} min={0} step="0.01" />
        </label>
        <label className="field-hint">
          Note (optional)
          <input className="text-input" value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary">
          Mark paid
        </button>
      </form>
      <p className="pa-note">Commission is calculated here but paid outside the system, then recorded — same as staff payroll.</p>

      <table className="pa-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {detail.payouts.map((p) => (
            <tr key={p.id}>
              <td>{formatDateTime(p.paidAt)}</td>
              <td className="pa-numeric">{formatCents(p.amountCents)}</td>
              <td>{p.note ?? "—"}</td>
            </tr>
          ))}
          {detail.payouts.length === 0 ? (
            <tr>
              <td colSpan={3} className="field-hint">
                No payouts recorded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="field-hint" style={{ marginTop: 8 }}>
        Created {formatDate(detail.createdAt)} · code {detail.code}
      </p>
    </section>
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
