/**
 * FullPageSpinner is the only export still referenced (by PlatformAdminRouteGuards).
 * The RequireAuth/RequireGuest guards that relied on the now-removed store-owner
 * AuthContext are gone.
 */
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
