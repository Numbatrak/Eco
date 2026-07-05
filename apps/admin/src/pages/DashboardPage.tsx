import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage(): React.ReactElement {
  const { currentTenant } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1>Overview</h1>
        <p className="field-hint">
          {currentTenant?.subdomain
            ? `Your storefront: ${currentTenant.subdomain}`
            : "Set a subdomain in Site settings to start publishing your storefront."}
        </p>
      </div>
      <div className="panel" style={{ padding: "var(--space-5)", display: "flex", gap: "var(--space-3)" }}>
        <Link to="/products" className="btn btn-secondary">
          Manage products
        </Link>
        <Link to="/orders" className="btn btn-secondary">
          View orders
        </Link>
        <Link to="/payment-settings" className="btn btn-secondary">
          Payment settings
        </Link>
      </div>
    </div>
  );
}
