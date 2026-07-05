import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage(): React.ReactElement {
  const { user, logout } = useAuth();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-6)" }}>
      <h1>Dashboard</h1>
      <p className="field-hint">
        Storefront builder scaffold placeholder. Signed in as {user?.id}.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: "var(--space-5)" }}>
        <Link to="/security" className="btn btn-secondary">
          Security settings
        </Link>
        <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    </main>
  );
}
