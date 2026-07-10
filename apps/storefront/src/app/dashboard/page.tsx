"use client";

import Link from "next/link";
import { RequireAuth } from "../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { useAuth } from "../../components/dashboard/AuthContext";

function OverviewInner(): React.ReactElement {
  const { activeOrganization } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1>Overview</h1>
        <p className="field-hint">
          {activeOrganization?.slug
            ? `Your storefront: ${activeOrganization.slug}`
            : "Set a subdomain in Site settings to start publishing your storefront."}
        </p>
      </div>
      <div
        className="panel"
        style={{ padding: "var(--space-5)", display: "flex", gap: "var(--space-3)" }}
      >
        <Link href="/dashboard/products" className="btn btn-secondary">
          Manage products
        </Link>
        <Link href="/dashboard/orders" className="btn btn-secondary">
          View orders
        </Link>
        <Link href="/dashboard/payment-settings" className="btn btn-secondary">
          Payment settings
        </Link>
      </div>
    </div>
  );
}

export default function DashboardOverviewPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <OverviewInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
