import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  PlatformAdminTenantSummary,
  TenantLifecycleStatus,
} from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate } from "../lib/format";

const PAGE_SIZE = 20;

const STATUSES: TenantLifecycleStatus[] = [
  "active",
  "trial",
  "past_due",
  "locked",
  "cancelled",
  "suspended",
];
const PLAN_TIERS = ["starter", "growth", "pro"];

function isoStartOfDay(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}
function isoEndOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

export default function TenantsPage(): React.ReactElement {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantLifecycleStatus | "">("");
  const [plan, setPlan] = useState("");
  const [signupSource, setSignupSource] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [page, setPage] = useState(1);

  const [tenants, setTenants] = useState<PlatformAdminTenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformAdminApi
      .listTenants({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        plan: plan || undefined,
        signupSource: signupSource || undefined,
        from: fromInput ? isoStartOfDay(fromInput) : undefined,
        to: toInput ? isoEndOfDay(toInput) : undefined,
      })
      .then((res) => {
        setTenants(res.tenants);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load tenants."));
  }, [page, search, status, plan, signupSource, fromInput, toInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilterReset(): void {
    setPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Tenants</h1>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="search"
            className="text-input"
            placeholder="Name, subdomain, or owner email"
            aria-label="Search tenants"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      <div className="pa-filter-bar">
        <label className="field-hint">
          Status
          <select
            className="text-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TenantLifecycleStatus | "");
              applyFilterReset();
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field-hint">
          Plan
          <select
            className="text-input"
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              applyFilterReset();
            }}
          >
            <option value="">All</option>
            {PLAN_TIERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="field-hint">
          Source
          <input
            type="text"
            className="text-input"
            placeholder="e.g. google"
            value={signupSource}
            onChange={(e) => {
              setSignupSource(e.target.value.trim());
              applyFilterReset();
            }}
          />
        </label>
        <label className="field-hint">
          Signed up from
          <input
            type="date"
            className="text-input"
            value={fromInput}
            onChange={(e) => {
              setFromInput(e.target.value);
              applyFilterReset();
            }}
          />
        </label>
        <label className="field-hint">
          to
          <input
            type="date"
            className="text-input"
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              applyFilterReset();
            }}
          />
        </label>
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>MRR</th>
                  <th>Team</th>
                  <th>Credits (e / w)</th>
                  <th>Source</th>
                  <th>Signed up</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link className="pa-table-link" to={`/tenants/${t.id}`}>
                        {t.name}
                      </Link>
                      <div className="field-hint">{t.subdomain}</div>
                    </td>
                    <td>{t.ownerEmail ?? "—"}</td>
                    <td>
                      <span className={`pa-badge pa-badge-${t.status}`}>{t.status}</span>
                    </td>
                    <td>{t.planTier ?? "—"}</td>
                    <td className="pa-numeric">{formatCents(t.mrrContributionCents)}</td>
                    <td className="pa-numeric">{t.teamSize}</td>
                    <td className="pa-numeric">
                      {t.emailCredits} / {t.whatsappCredits}
                    </td>
                    <td>{t.signupSource ?? "direct"}</td>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>{t.lastActiveAt ? formatDate(t.lastActiveAt) : "—"}</td>
                  </tr>
                ))}
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="field-hint">
                      No tenants match these filters.
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
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
