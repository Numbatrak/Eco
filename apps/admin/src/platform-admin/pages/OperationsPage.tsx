import { useEffect, useState } from "react";
import type {
  Announcement,
  AnnouncementAudience,
  FeatureUsageResponse,
  ChurnAnalyticsResponse,
  IntegrationHealthResponse,
  AuditLogEntry,
  ErrorLogEntry,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

type SubTab = "announcements" | "features" | "churn" | "integrations" | "audit" | "errors";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "announcements", label: "Announcements" },
  { key: "features", label: "Feature usage" },
  { key: "churn", label: "Churn analytics" },
  { key: "integrations", label: "Integration health" },
  { key: "audit", label: "Audit log" },
  { key: "errors", label: "Error log" },
];

function defaultDateInput(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function OperationsPage(): React.ReactElement {
  const [tab, setTab] = useState<SubTab>("announcements");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Operations</h1>
      </div>
      <div className="pa-tabs">
        {SUB_TABS.map((t) => (
          <button key={t.key} type="button" className={`pa-tab ${tab === t.key ? "active" : ""}`} onClick={() => { setTab(t.key); setError(null); }}>
            {t.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      {tab === "announcements" ? <AnnouncementsView setError={setError} /> : null}
      {tab === "features" ? <FeatureUsageView setError={setError} /> : null}
      {tab === "churn" ? <ChurnView setError={setError} /> : null}
      {tab === "integrations" ? <IntegrationsView setError={setError} /> : null}
      {tab === "audit" ? <AuditView setError={setError} /> : null}
      {tab === "errors" ? <ErrorsView setError={setError} /> : null}
    </div>
  );
}

type SetError = (s: string | null) => void;

function AnnouncementsView({ setError }: { setError: SetError }): React.ReactElement {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [audienceValue, setAudienceValue] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

  const load = () => platformAdminApi.getAnnouncements().then((r) => setList(r.announcements)).catch(() => setError("Could not load announcements."));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    platformAdminApi
      .createAnnouncement({ title: title.trim(), body: body.trim(), audience, audienceValue: audience === "all" ? undefined : audienceValue.trim(), sendEmail })
      .then(() => { setTitle(""); setBody(""); setAudienceValue(""); void load(); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not broadcast."));
  }

  return (
    <div>
      <section style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2>Broadcast announcement</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="ann-title">Title</label>
            <input id="ann-title" className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ann-body">Message</label>
            <textarea id="ann-body" className="text-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <div className="pa-filter-bar">
            <label className="field-hint">
              Audience
              <select className="text-input" value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}>
                <option value="all">All tenants</option>
                <option value="tier">Plan tier</option>
                <option value="tenant">Single tenant</option>
              </select>
            </label>
            {audience !== "all" ? (
              <label className="field-hint">
                {audience === "tier" ? "Tier (starter/growth/pro)" : "Tenant id"}
                <input className="text-input" value={audienceValue} onChange={(e) => setAudienceValue(e.target.value)} />
              </label>
            ) : null}
            <label className="field-hint" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Also email
            </label>
            <button type="submit" className="btn btn-primary">Broadcast</button>
          </div>
        </form>
        <p className="pa-note">Recorded and counted now; delivery to the tenant bell / email is wired separately.</p>
      </section>

      <table className="pa-table">
        <thead>
          <tr><th>Date</th><th>Title</th><th>Audience</th><th>Recipients</th><th>Email</th></tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td>{formatDateTime(a.createdAt)}</td>
              <td>{a.title}<div className="field-hint">{a.body.slice(0, 60)}</div></td>
              <td>{a.audience}{a.audienceValue ? `: ${a.audienceValue}` : ""}</td>
              <td className="pa-numeric">{a.recipientCount}</td>
              <td>{a.sendEmail ? "yes" : "no"}</td>
            </tr>
          ))}
          {list.length === 0 ? <tr><td colSpan={5} className="field-hint">No announcements yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function FeatureUsageView({ setError }: { setError: SetError }): React.ReactElement {
  const [data, setData] = useState<FeatureUsageResponse | null>(null);
  useEffect(() => { platformAdminApi.getFeatureUsage().then(setData).catch(() => setError("Could not load feature usage.")); }, [setError]);
  if (!data) return <p className="field-hint">Loading…</p>;
  return (
    <div>
      <p className="field-hint">Adoption across {data.totalTenants} tenant(s).</p>
      <table className="pa-table">
        <thead><tr><th>Feature</th><th>Adopted</th><th>Adoption rate</th></tr></thead>
        <tbody>
          {data.features.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              <td className="pa-numeric">{f.adopted} / {data.totalTenants}</td>
              <td className="pa-numeric">{Math.round(f.rate * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pa-note">Capability adoption (does a tenant use the feature at all). Per-action usage frequency is future instrumentation.</p>
    </div>
  );
}

function ChurnView({ setError }: { setError: SetError }): React.ReactElement {
  const [from, setFrom] = useState(() => defaultDateInput(90));
  const [to, setTo] = useState(() => defaultDateInput(0));
  const [data, setData] = useState<ChurnAnalyticsResponse | null>(null);
  useEffect(() => {
    platformAdminApi
      .getChurnAnalytics({ from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59Z`).toISOString() })
      .then(setData)
      .catch(() => setError("Could not load churn analytics."));
  }, [from, to, setError]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label className="field-hint" htmlFor="ch-from">From</label>
        <input id="ch-from" type="date" className="text-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="field-hint" htmlFor="ch-to">To</label>
        <input id="ch-to" type="date" className="text-input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="pa-kpi-grid">
        <div className="pa-kpi-card"><div className="pa-kpi-label">Total churned</div><div className="pa-kpi-value">{data?.totalChurned ?? "—"}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
        <Breakdown title="By plan tier" rows={data?.byTier ?? []} />
        <Breakdown title="By tenure" rows={data?.byTenure ?? []} />
        <Breakdown title="By reason" rows={data?.byReason ?? []} empty={data && !data.hasSurveyData ? "No exit-survey data yet." : undefined} />
        <Breakdown title="By exit type" rows={data?.byExitType ?? []} empty={data && !data.hasSurveyData ? "No exit-survey data yet." : undefined} />
      </div>
      {data && !data.hasSurveyData ? (
        <p className="pa-note">Reason / exit-type breakdowns fill in once the cancel &amp; delete exit surveys are wired to flow here.</p>
      ) : null}
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty?: string }): React.ReactElement {
  return (
    <div>
      <div className="pa-kpi-label">{title}</div>
      <table className="pa-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td className="pa-numeric">{r.count}</td></tr>
          ))}
          {rows.length === 0 ? <tr><td className="field-hint">{empty ?? "None"}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function IntegrationsView({ setError }: { setError: SetError }): React.ReactElement {
  const [data, setData] = useState<IntegrationHealthResponse | null>(null);
  useEffect(() => { platformAdminApi.getIntegrationHealth().then(setData).catch(() => setError("Could not load integration health.")); }, [setError]);
  const badge = (status: string) => (status === "healthy" ? "healthy" : status === "erroring" ? "critical" : "unknown");
  return (
    <div className="pa-kpi-grid">
      {(data?.integrations ?? []).map((i) => (
        <div className="pa-kpi-card" key={i.key}>
          <div className="pa-kpi-label">{i.label}</div>
          <div style={{ marginTop: 6 }}>
            <span className={`pa-health pa-health-${badge(i.status)}`}>{i.status.replace("_", " ")}</span>
          </div>
          <div className="pa-kpi-sub">{i.recentErrors} error(s) in the last 7 days</div>
        </div>
      ))}
    </div>
  );
}

function AuditView({ setError }: { setError: SetError }): React.ReactElement {
  const [action, setAction] = useState("");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const query = { page: 1, pageSize: 100, action: action || undefined };
  useEffect(() => {
    platformAdminApi.getAuditLog(query).then((r) => setEntries(r.entries)).catch(() => setError("Could not load audit log."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);
  return (
    <div>
      <div className="pa-filter-bar">
        <label className="field-hint">Action<input className="text-input" placeholder="e.g. tenant_suspended" value={action} onChange={(e) => setAction(e.target.value.trim())} /></label>
        <button type="button" className="btn btn-secondary" onClick={() => platformAdminApi.downloadAuditCsv(query).catch(() => setError("Export failed."))}>Export CSV</button>
      </div>
      <table className="pa-table">
        <thead><tr><th>Date</th><th>Action</th><th>Target</th><th>Admin</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{formatDateTime(e.createdAt)}</td>
              <td>{e.action}</td>
              <td className="field-hint">{e.targetType}{e.targetId ? `:${e.targetId}` : ""}</td>
              <td className="field-hint">{e.adminId ?? "—"}</td>
            </tr>
          ))}
          {entries.length === 0 ? <tr><td colSpan={4} className="field-hint">No audit entries.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ErrorsView({ setError }: { setError: SetError }): React.ReactElement {
  const [source, setSource] = useState("");
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const query = { page: 1, pageSize: 100, source: source || undefined };
  useEffect(() => {
    platformAdminApi.getErrorLog(query).then((r) => setEntries(r.entries)).catch(() => setError("Could not load error log."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  return (
    <div>
      <div className="pa-filter-bar">
        <label className="field-hint">Source
          <select className="text-input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="api">api</option>
            <option value="webhook">webhook</option>
            <option value="cron">cron</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => platformAdminApi.downloadErrorCsv(query).catch(() => setError("Export failed."))}>Export CSV</button>
      </div>
      <table className="pa-table">
        <thead><tr><th>Date</th><th>Source</th><th>Level</th><th>Message</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{formatDateTime(e.createdAt)}</td>
              <td>{e.source}</td>
              <td>{e.level}</td>
              <td className="field-hint">{e.message}</td>
            </tr>
          ))}
          {entries.length === 0 ? <tr><td colSpan={4} className="field-hint">No errors logged.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
