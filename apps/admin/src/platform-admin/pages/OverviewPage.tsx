import { useEffect, useState } from "react";
import type {
  OverviewResponse,
  OverviewHealth,
  OverviewTrendsResponse,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatPercent, formatRatio } from "../lib/format";

const TREND_WEEKS = [4, 8, 12] as const;

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

function dimStatus(health: OverviewHealth | undefined, key: string): string {
  const dim = health?.dimensions.find((d) => d.key === key);
  return dim ? `is-${dim.status}` : "";
}

function titleCase(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function tierLine(byTier: Record<string, number>): string {
  const entries = Object.entries(byTier);
  if (entries.length === 0) return "No active tiers";
  return entries.map(([tier, n]) => `${titleCase(tier)} ${n}`).join(" · ");
}

function Sparkline({ points }: { points: { weekStart: string; value: number }[] }): React.ReactElement {
  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const hasData = values.some((v) => v > 0);
  const w = 220;
  const h = 40;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - (p.value / max) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <div>
      <svg width={w} height={h} role="img" aria-label="Trend sparkline">
        <polyline points={coords} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {!hasData ? <div className="pa-note">No trend history yet — snapshots accrue daily.</div> : null}
    </div>
  );
}

export default function OverviewPage(): React.ReactElement {
  const [fromInput, setFromInput] = useState(() => defaultDateInput(30));
  const [toInput, setToInput] = useState(() => defaultDateInput(0));
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [trendWeeks, setTrendWeeks] = useState<(typeof TREND_WEEKS)[number]>(12);
  const [trends, setTrends] = useState<OverviewTrendsResponse | null>(null);

  useEffect(() => {
    platformAdminApi
      .getOverview({ from: isoStartOfDay(fromInput), to: isoEndOfDay(toInput) })
      .then(setOverview)
      .catch(() => setOverviewError("Could not load metrics."));
  }, [fromInput, toInput]);

  useEffect(() => {
    platformAdminApi
      .getOverviewTrends({ metric: "mrr", weeks: trendWeeks })
      .then(setTrends)
      .catch(() => setTrends(null));
  }, [trendWeeks]);

  const h = overview?.headline;
  const rev = overview?.revenueSplit;
  const econ = overview?.unitEconomics;
  const health = overview?.health;

  return (
    <div>
      <div className="pa-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1>Overview</h1>
          {health && !health.isEmpty ? (
            <span className={`pa-health pa-health-${health.overall}`}>{health.overall}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="field-hint" htmlFor="pa-from-date">
            From
          </label>
          <input
            id="pa-from-date"
            type="date"
            className="text-input"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
          />
          <label className="field-hint" htmlFor="pa-to-date">
            To
          </label>
          <input
            id="pa-to-date"
            type="date"
            className="text-input"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
          />
        </div>
      </div>

      {overviewError ? (
        <div className="banner banner-danger" role="alert">
          {overviewError}
        </div>
      ) : health?.isEmpty ? (
        <div className="banner" role="status">
          Numbatrak is live. Waiting for the first signup.
        </div>
      ) : (
        <>
          {/* Zone 1 — headline metrics */}
          <section className="pa-zone">
            <div className="pa-zone-head">
              <h2>Headline</h2>
            </div>
            <div className="pa-kpi-grid">
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">MRR</div>
                <div className="pa-kpi-value">{h ? formatCents(h.mrrCents) : "—"}</div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">ARR</div>
                <div className="pa-kpi-value">{h ? formatCents(h.arrCents) : "—"}</div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Active subscriptions</div>
                <div className="pa-kpi-value">{h?.activeSubscriptions ?? "—"}</div>
                {h ? <div className="pa-kpi-sub">{tierLine(h.activeByTier)}</div> : null}
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Trial accounts</div>
                <div className="pa-kpi-value">{h?.trialAccounts ?? "—"}</div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Churn rate</div>
                <div className={`pa-kpi-value ${dimStatus(health, "churn")}`}>
                  {formatPercent(h?.churnRatePct ?? null)}
                </div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Trial → paid</div>
                <div className={`pa-kpi-value ${dimStatus(health, "trialToPaid")}`}>
                  {formatPercent(h?.trialToPaidPct ?? null)}
                </div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">New signups</div>
                <div className="pa-kpi-value">{h?.newSignups ?? "—"}</div>
                {h && h.newSignupsBySource.length > 0 ? (
                  <div className="pa-kpi-sub">
                    {h.newSignupsBySource
                      .slice(0, 3)
                      .map((s) => `${s.source} ${s.count}`)
                      .join(" · ")}
                  </div>
                ) : null}
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">DAU / MAU</div>
                <div className="pa-kpi-value">{h ? `${h.dau} / ${h.mau}` : "—"}</div>
                {h ? (
                  <div className="pa-kpi-sub">
                    Stickiness {h.dauMauRatio === null ? "—" : `${Math.round(h.dauMauRatio * 100)}%`}
                  </div>
                ) : null}
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Failed payments</div>
                <div className={`pa-kpi-value ${dimStatus(health, "failedPayments")}`}>
                  {h?.failedPayments ?? "—"}
                </div>
                {h ? (
                  <div className="pa-kpi-sub">
                    Grace {h.dunningStages.grace} · Locked {h.dunningStages.locked}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="pa-zone-head" style={{ marginTop: "var(--space-3)" }}>
              <h2>MRR trend</h2>
              <div className="pa-tabs" style={{ border: "none", margin: 0 }}>
                {TREND_WEEKS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`pa-tab ${trendWeeks === w ? "active" : ""}`}
                    onClick={() => setTrendWeeks(w)}
                  >
                    {w}w
                  </button>
                ))}
              </div>
            </div>
            {trends ? <Sparkline points={trends.points} /> : null}
          </section>

          {/* Zone 2 — revenue split */}
          <section className="pa-zone">
            <div className="pa-zone-head">
              <h2>Revenue split</h2>
              {rev ? (
                <span className="field-hint">
                  Combined net {formatCents(rev.combined.netCents)} (VAT {formatCents(rev.combined.vatCents)})
                </span>
              ) : null}
            </div>
            <div className="pa-kpi-grid">
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Subscriptions — net</div>
                <div className="pa-kpi-value">{rev ? formatCents(rev.subscription.netCents) : "—"}</div>
                {rev ? (
                  <div className="pa-kpi-sub">
                    Gross {formatCents(rev.subscription.grossCents)} · VAT {formatCents(rev.subscription.vatCents)}
                    <br />
                    Monthly {formatCents(rev.subscription.monthlyGrossCents)} · Annual{" "}
                    {formatCents(rev.subscription.annualGrossCents)}
                  </div>
                ) : null}
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Credit sales — net</div>
                <div className="pa-kpi-value">{rev ? formatCents(rev.credit.netCents) : "—"}</div>
                {rev ? (
                  <div className="pa-kpi-sub">
                    Email {formatCents(rev.credit.emailGrossCents)} · WhatsApp {formatCents(rev.credit.whatsappGrossCents)}
                  </div>
                ) : null}
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Combined gross</div>
                <div className="pa-kpi-value">{rev ? formatCents(rev.combined.grossCents) : "—"}</div>
              </div>
            </div>
          </section>

          {/* Zone 3 — unit economics */}
          <section className="pa-zone">
            <div className="pa-zone-head">
              <h2>Unit economics</h2>
            </div>
            <div className="pa-kpi-grid">
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">CAC</div>
                <div className="pa-kpi-value">{econ?.cacCents != null ? formatCents(econ.cacCents) : "—"}</div>
                <div className="pa-kpi-sub">Awaits ad-spend data</div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">LTV</div>
                <div className="pa-kpi-value">{econ?.ltvCents != null ? formatCents(econ.ltvCents) : "—"}</div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">LTV : CAC</div>
                <div className={`pa-kpi-value ${dimStatus(health, "ltvToCac")}`}>
                  {formatRatio(econ?.ltvToCacRatio ?? null)}
                </div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Payback</div>
                <div className="pa-kpi-value">
                  {econ?.paybackMonths != null ? `${econ.paybackMonths.toFixed(1)} mo` : "—"}
                </div>
              </div>
              <div className="pa-kpi-card">
                <div className="pa-kpi-label">Net revenue retention</div>
                <div className="pa-kpi-value">{formatPercent(econ?.netRevenueRetentionPct ?? null)}</div>
              </div>
            </div>
          </section>

          {overview && overview.notes.length > 0 ? (
            <div className="pa-zone">
              {overview.notes.map((note, i) => (
                <div className="pa-note" key={i}>
                  {note}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
