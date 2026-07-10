import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MetricsOverviewResponse, PlatformAdminTenantSummary } from "@platform/shared-types";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate } from "../lib/format";

const PAGE_SIZE = 20;

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

export default function OverviewPage(): React.ReactElement {
  const [fromInput, setFromInput] = useState(() => defaultDateInput(30));
  const [toInput, setToInput] = useState(() => defaultDateInput(0));
  const [metrics, setMetrics] = useState<MetricsOverviewResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [tenants, setTenants] = useState<PlatformAdminTenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  useEffect(() => {
    platformAdminApi
      .getMetricsOverview({ from: isoStartOfDay(fromInput), to: isoEndOfDay(toInput) })
      .then(setMetrics)
      .catch(() => setMetricsError("Could not load metrics."));
  }, [fromInput, toInput]);

  useEffect(() => {
    platformAdminApi
      .listTenants({ page, pageSize: PAGE_SIZE, search: search || undefined })
      .then((response) => {
        setTenants(response.tenants);
        setTotal(response.total);
      })
      .catch(() => setTenantsError("Could not load tenants."));
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSearchSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="pa-toolbar">
        <h1>Overview</h1>
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

      {metricsError ? (
        <div className="banner banner-danger" role="alert">
          {metricsError}
        </div>
      ) : (
        <div className="pa-kpi-grid">
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">Revenue</div>
            <div className="pa-kpi-value">{metrics ? formatCents(metrics.revenueCents) : "—"}</div>
          </div>
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">Order volume</div>
            <div className="pa-kpi-value">{metrics?.orderCount ?? "—"}</div>
          </div>
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">Active tenants</div>
            <div className="pa-kpi-value">{metrics?.activeTenantCount ?? "—"}</div>
          </div>
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">New signups</div>
            <div className="pa-kpi-value">{metrics?.newTenantSignups ?? "—"}</div>
          </div>
        </div>
      )}

      <div className="pa-toolbar">
        <h2>Tenants</h2>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="search"
            className="text-input"
            placeholder="Search name or subdomain"
            aria-label="Search tenants"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {tenantsError ? (
        <div className="banner banner-danger" role="alert">
          {tenantsError}
        </div>
      ) : (
        <>
          <table className="pa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subdomain</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Credit balance</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <Link className="pa-table-link" to={`/tenants/${tenant.id}`}>
                      {tenant.name}
                    </Link>
                  </td>
                  <td>{tenant.subdomain}</td>
                  <td>
                    <span className={`pa-badge pa-badge-${tenant.status}`}>{tenant.status}</span>
                  </td>
                  <td>{tenant.plan}</td>
                  <td className="pa-numeric">{tenant.creditBalance}</td>
                  <td className="pa-numeric">{tenant.orderCount}</td>
                  <td className="pa-numeric">{formatCents(tenant.revenueCents)}</td>
                  <td>{formatDate(tenant.createdAt)}</td>
                </tr>
              ))}
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="field-hint">
                    No tenants found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

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
