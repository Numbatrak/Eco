import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/products", label: "Products" },
  { to: "/orders", label: "Orders" },
  { to: "/payment-settings", label: "Payment settings" },
  { to: "/site-settings", label: "Site settings" },
  { to: "/security", label: "Security" },
];

export default function DashboardLayout(): React.ReactElement {
  const { user, currentTenant, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <strong>{currentTenant?.name ?? "Your store"}</strong>
          {user?.email ? <span className="field-hint">{user.email}</span> : null}
        </div>
        <nav className="dashboard-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `dashboard-nav-link${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => void logout()}>
          Log out
        </button>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
