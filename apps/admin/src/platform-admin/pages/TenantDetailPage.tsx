import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import {
  grantTenantCreditsRequestSchema,
  updateTenantPlanRequestSchema,
  extendTrialRequestSchema,
  type GrantTenantCreditsRequest,
  type PlatformAdminTenantDetail,
  type UpdateTenantPlanRequest,
  type ExtendTrialRequest,
} from "@platform/shared-types";
import { TextField } from "../../components/TextField";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDate, formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

const PLAN_TIERS = ["starter", "growth", "pro"];

export default function TenantDetailPage(): React.ReactElement {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<PlatformAdminTenantDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [suspendReason, setSuspendReason] = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  function load(): void {
    if (!tenantId) return;
    platformAdminApi
      .getTenant(tenantId)
      .then(setTenant)
      .catch(() => setLoadError("Could not load this tenant."));
  }

  useEffect(load, [tenantId]);

  const planForm = useForm<UpdateTenantPlanRequest>({
    resolver: zodResolver(updateTenantPlanRequestSchema),
    values: tenant ? { plan: tenant.planTier ?? "starter", reason: "" } : undefined,
  });

  const creditForm = useForm<GrantTenantCreditsRequest>({
    resolver: zodResolver(grantTenantCreditsRequestSchema),
    defaultValues: { creditType: "email", amount: 0, reason: "" },
  });

  const trialForm = useForm<ExtendTrialRequest>({
    resolver: zodResolver(extendTrialRequestSchema),
    defaultValues: { days: 7, reason: "" },
  });

  if (loadError) {
    return (
      <div className="banner banner-danger" role="alert">
        {loadError}
      </div>
    );
  }
  if (!tenant) {
    return <p className="field-hint">Loading…</p>;
  }

  function runAction(fn: () => Promise<unknown>, notice?: string): void {
    setActionError(null);
    setActionNotice(null);
    Promise.resolve(fn())
      .then(() => {
        if (notice) setActionNotice(notice);
        load();
      })
      .catch((error) => {
        setActionError(error instanceof ApiError ? error.message : "Something went wrong.");
      });
  }

  const sub = tenant.subscription;
  const isSuspended = tenant.status === "suspended";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div className="pa-toolbar">
          <h1>{tenant.name}</h1>
          <span className={`pa-badge pa-badge-${tenant.status}`}>{tenant.status}</span>
        </div>

        {/* (1) Account details + plan */}
        <div className="panel" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Field label="Subdomain" value={tenant.subdomain} />
          <Field label="Owner" value={tenant.ownerEmail ?? "—"} />
          <Field label="Plan tier" value={tenant.planTier ?? "—"} />
          <Field label="MRR contribution" value={formatCents(tenant.mrrContributionCents)} numeric />
          <Field label="Team size" value={String(tenant.teamSize)} numeric />
          <Field label="Signup source" value={tenant.signupSource ?? "direct"} />
          <Field label="Created" value={formatDateTime(tenant.createdAt)} />
          <Field label="Last active" value={tenant.lastActiveAt ? formatDateTime(tenant.lastActiveAt) : "—"} />
        </div>
      </div>

      {/* (1b) Subscription */}
      {sub ? (
        <section>
          <h2>Subscription</h2>
          <div className="panel" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Field label="Status" value={sub.status} />
            <Field label="Billing" value={sub.billingInterval ?? "—"} />
            <Field label="Current period ends" value={sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"} />
            <Field label="Trial ends" value={sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "—"} />
            <Field label="Grace ends" value={sub.gracePeriodEndsAt ? formatDateTime(sub.gracePeriodEndsAt) : "—"} />
            <Field label="Locked at" value={sub.lockedAt ? formatDateTime(sub.lockedAt) : "—"} />
            <Field label="Cancelled at" value={sub.cancelledAt ? formatDateTime(sub.cancelledAt) : "—"} />
            <Field
              label="Retention"
              value={sub.deletable ? "Window expired (deletable)" : sub.inRetentionWindow ? "In 90-day window" : "—"}
            />
          </div>
        </section>
      ) : (
        <div className="pa-note">No platform subscription on record for this tenant.</div>
      )}

      {actionError ? (
        <div className="banner banner-danger" role="alert">
          {actionError}
        </div>
      ) : null}
      {actionNotice ? (
        <div className="banner" role="status">
          {actionNotice}
        </div>
      ) : null}

      {/* Actions */}
      <section>
        <h2>Actions</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isSuspended ? (
            <button type="button" className="btn btn-primary" onClick={() => setConfirmReactivate(true)}>
              Reactivate tenant
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (!suspendReason.trim()) {
                  setActionError("A suspension reason is required.");
                  return;
                }
                setConfirmSuspend(true);
              }}
            >
              Suspend tenant
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>
            Reset owner password
          </button>
        </div>
        {!isSuspended ? (
          <div className="field" style={{ maxWidth: 420, marginTop: 8 }}>
            <label className="field-label" htmlFor="suspend-reason">
              Suspension reason
            </label>
            <textarea
              id="suspend-reason"
              className="text-input"
              rows={2}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend this tenant?"
        description="Their team will immediately lose dashboard access and their storefront shows a temporarily-unavailable page. Data stays intact; reversible."
        confirmLabel="Suspend"
        danger
        onCancel={() => setConfirmSuspend(false)}
        onConfirm={() => {
          setConfirmSuspend(false);
          runAction(() => platformAdminApi.suspendTenant(tenant.id, { reason: suspendReason.trim() }));
        }}
      />
      <ConfirmDialog
        open={confirmReactivate}
        title="Reactivate this tenant?"
        description="Their team regains dashboard access and their storefront becomes reachable again."
        confirmLabel="Reactivate"
        onCancel={() => setConfirmReactivate(false)}
        onConfirm={() => {
          setConfirmReactivate(false);
          runAction(() => platformAdminApi.reactivateTenant(tenant.id));
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Reset the owner's password?"
        description="Sends a password-reset email to the tenant owner. They complete the reset themselves — no password is set directly."
        confirmLabel="Send reset email"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          runAction(() => platformAdminApi.resetTenantPassword(tenant.id), "Password reset email sent to the owner.");
        }}
      />

      {/* Change plan */}
      <section style={{ maxWidth: 480 }}>
        <h2>Change plan</h2>
        <form
          onSubmit={planForm.handleSubmit((values) =>
            runAction(() => platformAdminApi.updateTenantPlan(tenant.id, values)),
          )}
        >
          <div className="field">
            <label className="field-label" htmlFor="plan-select">
              Plan tier
            </label>
            <select id="plan-select" className="text-input" {...planForm.register("plan")}>
              {PLAN_TIERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Reason (optional)" error={planForm.formState.errors.reason?.message} {...planForm.register("reason")} />
          <button type="submit" className="btn btn-secondary" disabled={planForm.formState.isSubmitting}>
            Save plan
          </button>
        </form>
      </section>

      {/* Extend trial */}
      <section style={{ maxWidth: 480 }}>
        <h2>Extend trial</h2>
        <form onSubmit={trialForm.handleSubmit((values) => runAction(() => platformAdminApi.extendTenantTrial(tenant.id, values)))}>
          <TextField
            label="Additional days"
            type="number"
            error={trialForm.formState.errors.days?.message}
            {...trialForm.register("days", { valueAsNumber: true })}
          />
          <TextField label="Reason" error={trialForm.formState.errors.reason?.message} {...trialForm.register("reason")} />
          <button type="submit" className="btn btn-secondary" disabled={trialForm.formState.isSubmitting}>
            Extend trial
          </button>
        </form>
      </section>

      {/* (5) Credits */}
      <section>
        <h2>Credits</h2>
        <div className="pa-kpi-grid">
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">Email balance</div>
            <div className="pa-kpi-value">{tenant.credits.emailBalance}</div>
          </div>
          <div className="pa-kpi-card">
            <div className="pa-kpi-label">WhatsApp balance</div>
            <div className="pa-kpi-value">{tenant.credits.whatsappBalance}</div>
          </div>
        </div>
        <form
          style={{ maxWidth: 480, marginTop: 12 }}
          onSubmit={creditForm.handleSubmit((values) =>
            runAction(async () => {
              await platformAdminApi.grantTenantCredits(tenant.id, values);
              creditForm.reset({ creditType: values.creditType, amount: 0, reason: "" });
            }),
          )}
        >
          <div className="field">
            <label className="field-label" htmlFor="credit-type">
              Pool
            </label>
            <select id="credit-type" className="text-input" {...creditForm.register("creditType")}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <TextField
            label="Amount"
            type="number"
            hint="Positive to grant, negative to deduct."
            error={creditForm.formState.errors.amount?.message}
            {...creditForm.register("amount", { valueAsNumber: true })}
          />
          <TextField label="Grant reason" error={creditForm.formState.errors.reason?.message} {...creditForm.register("reason")} />
          <button type="submit" className="btn btn-primary" disabled={creditForm.formState.isSubmitting}>
            Grant credits
          </button>
        </form>
        <table className="pa-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pool</th>
              <th>Delta</th>
              <th>Source</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {tenant.credits.history.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>{entry.creditType}</td>
                <td className="pa-numeric">{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</td>
                <td>{entry.source}</td>
                <td>{entry.reason}</td>
              </tr>
            ))}
            {tenant.credits.history.length === 0 ? (
              <tr>
                <td colSpan={5} className="field-hint">
                  No credit activity yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {/* (2) Payment history */}
      <section>
        <h2>Payment history</h2>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>VAT</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {tenant.transactions.map((t) => (
              <tr key={t.id}>
                <td>{formatDateTime(t.createdAt)}</td>
                <td>{t.type}</td>
                <td className="pa-numeric">{formatCents(t.amountCents)}</td>
                <td className="pa-numeric">{formatCents(t.vatCents)}</td>
                <td>{t.status}</td>
                <td className="field-hint">{t.paystackReference}</td>
              </tr>
            ))}
            {tenant.transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="field-hint">
                  No transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {/* (4) Team members */}
      <section>
        <h2>Team members</h2>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {tenant.team.map((m) => (
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.role}</td>
                <td>{formatDate(m.joinedAt)}</td>
              </tr>
            ))}
            {tenant.team.length === 0 ? (
              <tr>
                <td colSpan={4} className="field-hint">
                  No team members.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {/* (3) Feature usage — capability snapshot */}
      <section>
        <h2>Feature usage</h2>
        <div className="pa-kpi-grid">
          <Capability label="Products" value={`${tenant.capabilities.publishedProductCount} / ${tenant.capabilities.productCount} published`} />
          <Capability label="Collections" value={String(tenant.capabilities.collectionCount)} />
          <Capability label="Orders" value={String(tenant.capabilities.orderCount)} />
          <Capability label="Storefront" value={tenant.capabilities.storefrontPublished ? "Published" : "Not published"} />
          <Capability label="Payments" value={tenant.capabilities.paymentConfigured ? "Configured" : "Not set"} />
          <Capability label="Analytics" value={tenant.capabilities.analyticsConfigured ? "Configured" : "Not set"} />
          <Capability label="Delivery" value={tenant.capabilities.deliveryConfigured ? "Configured" : "Not set"} />
        </div>
        <div className="pa-note">Capability snapshot — per-feature adoption telemetry is tracked platform-wide in Operations (Tab 6).</div>
      </section>

      {/* (6) Activity log */}
      <section>
        <h2>Activity log</h2>
        <table className="pa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {tenant.activity.map((a) => (
              <tr key={a.id}>
                <td>{formatDateTime(a.createdAt)}</td>
                <td>{a.action}</td>
                <td className="field-hint">{a.adminId ?? "—"}</td>
              </tr>
            ))}
            {tenant.activity.length === 0 ? (
              <tr>
                <td colSpan={3} className="field-hint">
                  No admin actions recorded for this tenant.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {/* Danger zone — delete */}
      <section style={{ maxWidth: 480 }}>
        <h2>Danger zone</h2>
        {sub?.deletable ? (
          <div className="panel" style={{ padding: 16, border: "1px solid var(--danger)" }}>
            <p className="field-hint">
              Full data wipe. Irreversible. The revenue ledger is preserved. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              className="text-input"
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
            <textarea
              className="text-input"
              rows={2}
              placeholder="Reason"
              style={{ marginTop: 8 }}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-danger"
              style={{ marginTop: 8 }}
              disabled={deleteConfirmText !== "DELETE" || !deleteReason.trim()}
              onClick={() =>
                runAction(() =>
                  platformAdminApi.deleteTenant(tenant.id, { confirmation: "DELETE", reason: deleteReason.trim() }),
                )
              }
            >
              Permanently delete tenant
            </button>
          </div>
        ) : (
          <div className="pa-note">
            Delete becomes available only after the 90-day retention window expires (cancelled or locked tenants).
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, numeric }: { label: string; value: string; numeric?: boolean }): React.ReactElement {
  return (
    <div>
      <div className="pa-kpi-label">{label}</div>
      <div className={numeric ? "pa-numeric" : undefined}>{value}</div>
    </div>
  );
}

function Capability({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="pa-kpi-card">
      <div className="pa-kpi-label">{label}</div>
      <div>{value}</div>
    </div>
  );
}
