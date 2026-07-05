import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullPageSpinner(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "var(--muted)", fontFamily: "var(--font-body)" }}>Loading…</span>
    </div>
  );
}

/** Redirects unauthenticated users to /login; renders the protected subtree otherwise. */
export function RequireAuth(): React.ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageSpinner />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Redirects already-authenticated users away from guest-only pages (login/signup) to the dashboard. */
export function RequireGuest(): React.ReactElement {
  const { status } = useAuth();

  if (status === "loading") {
    return <FullPageSpinner />;
  }
  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
