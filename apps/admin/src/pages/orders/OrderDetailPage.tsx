import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { OrderDetail } from "@platform/shared-types";
import { useAuth } from "../../context/AuthContext";
import { commerceApi } from "../../lib/commerceApi";
import { formatCents } from "../../lib/money";

function Row({ label, value }: { label: string; value: ReactNode }): React.ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span className="field-hint">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function OrderDetailPage(): React.ReactElement {
  const { orderId } = useParams();
  const { accessToken, currentTenant } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !currentTenant || !orderId) {
      return;
    }
    commerceApi
      .getOrder(accessToken, currentTenant.id, orderId)
      .then(setOrder)
      .catch(() => setError("Could not load this order."));
  }, [accessToken, currentTenant, orderId]);

  if (error) {
    return (
      <div className="banner banner-danger" role="alert">
        {error}
      </div>
    );
  }
  if (!order) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 640 }}>
      <div>
        <Link to="/orders" className="btn-link">
          ← Back to orders
        </Link>
        <h1 style={{ marginTop: 12 }}>Order {order.orderNumber}</h1>
      </div>

      <div
        className="panel"
        style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <Row label="Status" value={<span className={`badge badge-${order.status}`}>{order.status}</span>} />
        <Row label="Customer" value={order.customerName} />
        <Row label="Email" value={order.customerEmail} />
        {order.customerPhone ? <Row label="Phone" value={order.customerPhone} /> : null}
        <Row label="Payment provider" value={order.paymentProvider} />
        <Row label="Payment reference" value={order.paymentReference ?? "—"} />
        <Row label="Placed" value={new Date(order.createdAt).toLocaleString()} />
      </div>

      <div className="panel" style={{ padding: "var(--space-5)" }}>
        <h2 style={{ marginBottom: "var(--space-3)" }}>Items</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nameSnapshot}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCents(item.unitPriceSnapshotCents, order.currency)}</td>
                  <td>{formatCents(item.lineTotalCents, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-3)", fontWeight: 600 }}>
          Total: {formatCents(order.totalCents, order.currency)}
        </div>
      </div>
    </div>
  );
}
