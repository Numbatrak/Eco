"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OrderSummary } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { commerceApi } from "../../../lib/commerceApi";
import { formatCents } from "../../../lib/money";

function OrdersList(): React.ReactElement {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commerceApi
      .listOrders()
      .then(({ orders: list }) => setOrders(list))
      .catch(() => setError("Could not load orders."));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1>Orders</h1>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

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
                <th>Customer</th>
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
                  <td>{order.customerName}</td>
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
  );
}

export default function OrdersListPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <OrdersList />
      </DashboardLayout>
    </RequireAuth>
  );
}
