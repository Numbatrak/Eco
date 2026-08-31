"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DiscountResponse } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { ConfirmDialog } from "../../../components/dashboard/ConfirmDialog";
import { commerceApi } from "../../../lib/commerceApi";

function DiscountsInner(): React.ReactElement {
  const [discounts, setDiscounts] = useState<DiscountResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiscountResponse | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { discounts: list } = await commerceApi.listDiscounts();
      setDiscounts(list);
    } catch {
      setError("Could not load discounts.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    await commerceApi.deleteDiscount(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Discounts</h1>
        <Link href="/dashboard/discounts/new" className="btn btn-primary">
          Add discount
        </Link>
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {discounts === null ? (
        <p className="field-hint">Loading discounts…</p>
      ) : discounts.length === 0 ? (
        <p className="field-hint">No discounts yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Code</th>
                <th>Type</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id}>
                  <td>{discount.title}</td>
                  <td>{discount.code ?? <em>Automatic</em>}</td>
                  <td>{discount.config.type.replace(/_/g, " ")}</td>
                  <td>
                    <span className={`badge badge-${discount.active ? "published" : "draft"}`}>
                      {discount.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Link href={`/dashboard/discounts/${discount.id}`} className="btn-link">
                        Edit
                      </Link>
                      <button type="button" className="btn-link" onClick={() => setDeleteTarget(discount)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this discount?"
        description={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function DiscountsListPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <DiscountsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
