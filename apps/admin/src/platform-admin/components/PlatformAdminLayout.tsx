import { NavLink, Outlet } from "react-router-dom";
import { usePlatformAdminAuth } from "../context/PlatformAdminAuthContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", end: true },
  { to: "/tenants", label: "Tenants" },
  { to: "/revenue", label: "Revenue" },
  { to: "/affiliates", label: "Affiliates" },
  { to: "/credits", label: "Credits" },
  { to: "/business-metrics", label: "Business Numbers" },
  { to: "/operations", label: "Operations" },
  { to: "/config", label: "Config" },
];

export default function PlatformAdminLayout(): React.ReactElement {
  const { admin, logout } = usePlatformAdminAuth();

  return (
    <div className="pa-shell">
      <div className="pa-dashboard-shell">
        <aside className="pa-sidebar">
          <div>
            <div className="pa-brand">Admin</div>
            {admin?.email ? <span className="field-hint">{admin.email}</span> : null}
          </div>
          <nav className="pa-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `pa-nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void logout()}>
            Log out
          </button>
        </aside>
        <main className="pa-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
