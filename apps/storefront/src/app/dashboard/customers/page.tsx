"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Customer } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { commerceApi } from "../../../lib/commerceApi";
import { formatCents } from "../../../lib/money";

function CustomersInner(): React.ReactElement {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commerceApi
      .listCustomers()
      .then(({ customers: list }) => setCustomers(list))
      .catch(() => setError("Could not load customers."));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <h1>Customers</h1>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {customers === null ? (
        <p className="field-hint">Loading customers…</p>
      ) : customers.length === 0 ? (
        <p className="field-hint">No customers yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link href={`/dashboard/customers/${customer.id}`} className="btn-link">
                      {customer.name}
                    </Link>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.phone ?? "—"}</td>
                  <td>{customer.orderCount}</td>
                  <td>{formatCents(customer.totalSpentCents, "NGN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CustomersListPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <CustomersInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
