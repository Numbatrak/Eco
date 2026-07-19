import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePlatformAdminAuth } from "../context/PlatformAdminAuthContext";
import { FullPageSpinner } from "../../components/RouteGuards";

/** Redirects unauthenticated users to /login; renders the protected subtree otherwise. */
export function RequirePlatformAdminAuth(): React.ReactElement {
  const { status } = usePlatformAdminAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageSpinner />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Redirects already-authenticated admins away from the login page to the overview. */
export function RequirePlatformAdminGuest(): React.ReactElement {
  const { status } = usePlatformAdminAuth();

  if (status === "loading") {
    return <FullPageSpinner />;
  }
  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
