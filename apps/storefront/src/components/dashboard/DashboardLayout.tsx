"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { RequireOrg } from "./RouteGuards";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/products", label: "Products" },
  { to: "/dashboard/collections", label: "Collections" },
  { to: "/dashboard/orders", label: "Orders" },
  { to: "/dashboard/customers", label: "Customers" },
  { to: "/dashboard/payment-settings", label: "Payments" },
  { to: "/dashboard/delivery-settings", label: "Delivery" },
  { to: "/dashboard/discounts", label: "Discounts" },
  { to: "/dashboard/analytics-settings", label: "Analytics" },
  { to: "/dashboard/builder", label: "Builder" },
  { to: "/dashboard/site-settings", label: "Site" },
  { to: "/dashboard/team", label: "Team" },
  { to: "/dashboard/security", label: "Security" },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function OrgSwitcher(): React.ReactElement | null {
  const { organizations, activeOrganization, switchOrganization } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (organizations.length <= 1) return null;

  return (
    <select
      className="org-switcher"
      value={activeOrganization?.id ?? ""}
      disabled={switching}
      onChange={async (e) => {
        setSwitching(true);
        try {
          await switchOrganization(e.target.value);
        } finally {
          setSwitching(false);
        }
      }}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname() ?? "";
  const { user, activeOrganization, logout } = useAuth();

  return (
    <RequireOrg>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div>
            <div className="dashboard-brand">{activeOrganization?.name ?? "Dashboard"}</div>
            {user?.email ? <span className="field-hint">{user.email}</span> : null}
            <OrgSwitcher />
          </div>
          <nav className="dashboard-nav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={`dashboard-nav-link${isActive(pathname, item) ? " active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void logout()}>
            Log out
          </button>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </RequireOrg>
  );
}
