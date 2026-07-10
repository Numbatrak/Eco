"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/products", label: "Products" },
  { to: "/dashboard/orders", label: "Orders" },
  { to: "/dashboard/payment-settings", label: "Payments" },
  { to: "/dashboard/builder", label: "Builder" },
  { to: "/dashboard/site-settings", label: "Site" },
  { to: "/dashboard/security", label: "Security" },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function DashboardLayout({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname() ?? "";
  const { user, activeOrganization, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div>
          <div className="dashboard-brand">{activeOrganization?.name ?? "Dashboard"}</div>
          {user?.email ? <span className="field-hint">{user.email}</span> : null}
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
  );
}
