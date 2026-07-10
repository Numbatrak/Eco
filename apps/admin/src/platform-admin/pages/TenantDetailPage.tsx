import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import {
  adjustTenantCreditsRequestSchema,
  updateTenantPlanRequestSchema,
  type AdjustTenantCreditsRequest,
  type PlatformAdminTenantDetail,
  type UpdateTenantPlanRequest,
} from "@platform/shared-types";
import { TextField } from "../../components/TextField";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatCents, formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

export default function TenantDetailPage(): React.ReactElement {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<PlatformAdminTenantDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
    values: tenant ? { plan: tenant.plan } : undefined,
  });

  const creditForm = useForm<AdjustTenantCreditsRequest>({
    resolver: zodResolver(adjustTenantCreditsRequestSchema),
    defaultValues: { delta: 0, reason: "" },
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

  async function handleSuspendToggle(): Promise<void> {
    if (!tenantId) return;
    setActionError(null);
    try {
      if (tenant?.status === "active") {
        await platformAdminApi.suspendTenant(tenantId);
      } else {
        await platformAdminApi.reactivateTenant(tenantId);
      }
      setConfirmOpen(false);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  async function onSubmitPlan(values: UpdateTenantPlanRequest): Promise<void> {
    if (!tenantId) return;
    setActionError(null);
    try {
      await platformAdminApi.updateTenantPlan(tenantId, values);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  async function onSubmitCredits(values: AdjustTenantCreditsRequest): Promise<void> {
    if (!tenantId) return;
    setActionError(null);
    try {
      await platformAdminApi.adjustTenantCredits(tenantId, values);
      creditForm.reset({ delta: 0, reason: "" });
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  const isActive = tenant.status === "active";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div className="pa-toolbar">
          <h1>{tenant.name}</h1>
          <span className={`pa-badge pa-badge-${tenant.status}`}>{tenant.status}</span>
        </div>
        <div className="panel" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div>
            <div className="pa-kpi-label">Subdomain</div>
            <div>{tenant.subdomain}</div>
          </div>
          <div>
            <div className="pa-kpi-label">Plan</div>
            <div>{tenant.plan}</div>
          </div>
          <div>
            <div className="pa-kpi-label">Credit balance</div>
            <div className="pa-numeric">{tenant.creditBalance}</div>
          </div>
          <div>
            <div className="pa-kpi-label">Created</div>
            <div>{formatDateTime(tenant.createdAt)}</div>
          </div>
          <div>
            <div className="pa-kpi-label">Order count</div>
            <div className="pa-numeric">{tenant.orderCount}</div>
          </div>
          <div>
            <div className="pa-kpi-label">Revenue</div>
            <div className="pa-numeric">{formatCents(tenant.revenueCents)}</div>
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="banner banner-danger" role="alert">
          {actionError}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className={isActive ? "btn btn-danger" : "btn btn-primary"}
          onClick={() => setConfirmOpen(true)}
        >
          {isActive ? "Suspend tenant" : "Reactivate tenant"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={isActive ? "Suspend this tenant?" : "Reactivate this tenant?"}
        description={
          isActive
            ? "Their team will immediately lose dashboard access, and their published storefront will show a temporarily-unavailable page instead of loading normally."
            : "Their team will regain dashboard access, and their published storefront will become reachable again."
        }
        confirmLabel={isActive ? "Suspend" : "Reactivate"}
        danger={isActive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSuspendToggle}
      />

      <div>
        <h2>Plan</h2>
        <form
          onSubmit={planForm.handleSubmit(onSubmitPlan)}
          style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 320 }}
        >
          <div style={{ flex: 1 }}>
            <TextField
              label="Plan"
              error={planForm.formState.errors.plan?.message}
              {...planForm.register("plan")}
            />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={planForm.formState.isSubmitting}>
            Save
          </button>
        </form>
      </div>

      <div>
        <h2>Adjust credits</h2>
        <form onSubmit={creditForm.handleSubmit(onSubmitCredits)} style={{ maxWidth: 420 }}>
          <TextField
            label="Delta"
            type="number"
            hint="Positive to add credits, negative to remove."
            error={creditForm.formState.errors.delta?.message}
            {...creditForm.register("delta", { valueAsNumber: true })}
          />
          <div className="field">
            <label className="field-label" htmlFor="credit-reason">
              Reason
            </label>
            <textarea
              id="credit-reason"
              className="text-input"
              rows={3}
              aria-invalid={creditForm.formState.errors.reason ? "true" : undefined}
              {...creditForm.register("reason")}
            />
            {creditForm.formState.errors.reason ? (
              <span className="field-error" role="alert">
                {creditForm.formState.errors.reason.message}
              </span>
            ) : null}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={creditForm.formState.isSubmitting}
          >
            Apply adjustment
          </button>
        </form>

        <table className="pa-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Delta</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {tenant.creditAdjustments.map((adjustment) => (
              <tr key={adjustment.id}>
                <td>{formatDateTime(adjustment.createdAt)}</td>
                <td className="pa-numeric">{adjustment.delta > 0 ? `+${adjustment.delta}` : adjustment.delta}</td>
                <td>{adjustment.reason}</td>
              </tr>
            ))}
            {tenant.creditAdjustments.length === 0 ? (
              <tr>
                <td colSpan={3} className="field-hint">
                  No credit adjustments yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
