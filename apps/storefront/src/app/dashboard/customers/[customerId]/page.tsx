"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Customer, OrderSummary } from "@platform/shared-types";
import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { commerceApi } from "../../../../lib/commerceApi";
import { formatCents } from "../../../../lib/money";

function Row({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span className="field-hint">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CustomerDetailInner({ customerId }: { customerId: string }): React.ReactElement {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commerceApi
      .getCustomer(customerId)
      .then(setCustomer)
      .catch(() => setError("Could not load this customer."));
    commerceApi
      .listOrders(customerId)
      .then(({ orders: list }) => setOrders(list))
      .catch(() => setOrders([]));
  }, [customerId]);

  if (error) {
    return (
      <div className="banner banner-danger" role="alert">
        {error}
      </div>
    );
  }
  if (!customer) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 640 }}>
      <div>
        <Link href="/dashboard/customers" className="btn-link">
          ← Back to customers
        </Link>
        <h1 style={{ marginTop: 12 }}>{customer.name}</h1>
      </div>

      <div
        className="panel"
        style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <Row label="Email" value={customer.email} />
        <Row label="Phone" value={customer.phone ?? "—"} />
        <Row label="Address" value={customer.address ?? "—"} />
        <Row label="City" value={customer.city ?? "—"} />
        <Row label="State" value={customer.state ?? "—"} />
        <Row label="Orders" value={customer.orderCount} />
        <Row label="Total spent" value={formatCents(customer.totalSpentCents, "NGN")} />
      </div>

      <div className="panel" style={{ padding: "var(--space-5)" }}>
        <h2 style={{ marginBottom: "var(--space-3)" }}>Orders</h2>
        {orders === null ? (
          <p className="field-hint">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="field-hint">No orders yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/dashboard/orders/${order.id}`} className="btn-link">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{formatCents(order.totalCents, order.currency)}</td>
                    <td>
                      <span className={`badge badge-${order.status}`}>{order.status}</span>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}): React.ReactElement {
  const { customerId } = use(params);
  return (
    <RequireAuth>
      <DashboardLayout>
        <CustomerDetailInner customerId={customerId} />
      </DashboardLayout>
    </RequireAuth>
  );
}
