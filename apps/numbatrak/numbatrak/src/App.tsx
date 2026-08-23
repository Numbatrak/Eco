import { lazy, Suspense, useState, useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { Menu, Building2, ChevronDown, Moon, Sun, Star } from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { getDisplayName } from "./utils/userDisplay";
import { UserAvatar } from "./components/profile/UserAvatar";
import { useOrganization } from "./contexts/OrganizationContext";
import { useTheme } from "next-themes";
import { FaviconPreloader } from "./components/ui/FaviconPreloader";
import { Toaster } from "./components/ui/sonner";
import "./components/Dashboard.css";

// Every route is lazy-loaded so that visiting an already-ported page (right
// now: only /agents) never pulls in supabaseClient.ts (which throws
// synchronously without VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY - no longer
// set, since the app talks to apps/api now) through some other still-Supabase
// -backed page's static import. Every page below /agents is not yet ported
// and will error if actually visited - that's an explicit, incremental
// interim state, not a bug. See numbatrak frontend-port plan.
const DashboardPage = lazy(() => import("./components/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AgentsForm = lazy(() => import("./components/AgentsForm"));
const AgentDetailPage = lazy(() => import("./components/agents/AgentDetailPage"));
const ProductsForm = lazy(() => import("./components/ProductsForm"));
const FormsForm = lazy(() => import("./components/FormsForm"));
const FormBuilderPage = lazy(() => import("./components/forms/FormBuilderPage"));
const DeliveriesForm = lazy(() => import("./components/DeliveriesForm"));
const DeliveryAnalyticsPage = lazy(() =>
  import("./components/deliveryAnalytics/DeliveryAnalyticsPage").then((m) => ({ default: m.DeliveryAnalyticsPage })),
);
const WalletPage = lazy(() => import("./components/wallet/WalletPage").then((m) => ({ default: m.WalletPage })));
const PlaceholderPage = lazy(() => import("./components/PlaceholderPage").then((m) => ({ default: m.PlaceholderPage })));
const InventoryForm = lazy(() => import("./components/InventoryForm"));
const StaffForm = lazy(() => import("./components/StaffForm"));
const StaffDetailPage = lazy(() => import("./components/staff/StaffDetailPage"));
const PayrollPage = lazy(() => import("./components/payroll/PayrollPage").then((m) => ({ default: m.PayrollPage })));
const AttendancePage = lazy(() => import("./components/attendance/AttendancePage").then((m) => ({ default: m.AttendancePage })));
const StrikesPage = lazy(() => import("./components/strikes/StrikesPage").then((m) => ({ default: m.StrikesPage })));
const StarsPage = lazy(() => import("./components/stars/StarsPage").then((m) => ({ default: m.StarsPage })));
const LeavePage = lazy(() => import("./components/leave/LeavePage").then((m) => ({ default: m.LeavePage })));
const OrderAssignmentPage = lazy(() => import("./components/order-assignment/OrderAssignmentPage").then((m) => ({ default: m.OrderAssignmentPage })));
const MediaBuyersPage = lazy(() => import("./components/media-buyers/MediaBuyersPage").then((m) => ({ default: m.MediaBuyersPage })));
const CrmPage = lazy(() => import("./components/crm/CrmPage").then((m) => ({ default: m.CrmPage })));
const AccountingPage = lazy(() => import("./components/accounting/AccountingPage").then((m) => ({ default: m.AccountingPage })));
const InvoicingPage = lazy(() => import("./components/invoicing/InvoicingPage").then((m) => ({ default: m.InvoicingPage })));
const LoginPage = lazy(() => import("./components/LoginPage").then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import("./components/SignupPage").then((m) => ({ default: m.SignupPage })));
const EmailVerificationPage = lazy(() =>
  import("./components/EmailVerificationPage").then((m) => ({ default: m.EmailVerificationPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./components/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("./components/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const TermsOfServicePage = lazy(() =>
  import("./components/TermsOfServicePage").then((m) => ({ default: m.TermsOfServicePage })),
);
const PrivacyPolicyPage = lazy(() =>
  import("./components/PrivacyPolicyPage").then((m) => ({ default: m.PrivacyPolicyPage })),
);
const ImportWaybills = lazy(() => import("./components/ImportWaybills").then((m) => ({ default: m.ImportWaybills })));
const UnifiedExpensesForm = lazy(() => import("./components/UnifiedExpensesForm"));
const OrdersForm = lazy(() => import("./components/OrdersForm"));
const AbandonedCartsForm = lazy(() => import("./components/AbandonedCartsForm"));
const FollowUpsForm = lazy(() => import("./components/FollowUpsForm"));
const OrganizationSelectionPage = lazy(() =>
  import("./components/organizations/OrganizationSelectionPage").then((m) => ({ default: m.OrganizationSelectionPage })),
);
const SiteSettingsPage = lazy(() =>
  import("./pages/storefront/SiteSettingsPage").then((m) => ({ default: m.SiteSettingsPage })),
);
const PaymentSettingsPage = lazy(() =>
  import("./pages/storefront/PaymentSettingsPage").then((m) => ({ default: m.PaymentSettingsPage })),
);
const DeliverySettingsPage = lazy(() =>
  import("./pages/storefront/DeliverySettingsPage").then((m) => ({ default: m.DeliverySettingsPage })),
);
const AnalyticsSettingsPage = lazy(() =>
  import("./pages/storefront/AnalyticsSettingsPage").then((m) => ({ default: m.AnalyticsSettingsPage })),
);
const StorefrontBuilderPage = lazy(() =>
  import("./pages/storefront/StorefrontBuilderPage").then((m) => ({ default: m.StorefrontBuilderPage })),
);
const OrganizationSettingsPage = lazy(() =>
  import("./components/organizations/OrganizationSettingsPage").then((m) => ({ default: m.OrganizationSettingsPage })),
);
const AcceptInvitationPage = lazy(() =>
  import("./components/organizations/AcceptInvitationPage").then((m) => ({ default: m.AcceptInvitationPage })),
);
const ProfilePage = lazy(() => import("./components/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ProtectedRoute = lazy(() => import("./components/auth/ProtectedRoute").then((m) => ({ default: m.ProtectedRoute })));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <FaviconPreloader size={80} />
    </div>
  );
}

function AppContent() {
  const { status, user, logout } = useAuth();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const {
    currentOrganization,
    organizations,
    setCurrentOrganization,
    setDefaultOrganization,
    isDefaultOrganization,
    loading: orgLoading,
    needsOrganizationSelection,
  } = useOrganization();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close org selector when clicking outside
  useEffect(() => {
    if (showOrgSelector || showUserMenu) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-org-selector]")) {
          setShowOrgSelector(false);
        }
        if (!target.closest("[data-user-menu]")) {
          setShowUserMenu(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showOrgSelector, showUserMenu]);

  const isPublicPage =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/verify-email" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/terms" ||
    location.pathname === "/privacy";

  const isAcceptInvitationPage = location.pathname === "/accept-invitation";

  // Accept invitation works logged in or out — no org chrome required
  if (isAcceptInvitationPage) {
    if (authLoading) {
      return <RouteFallback />;
    }
    return (
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="*" element={<Navigate to="/accept-invitation" replace />} />
          </Routes>
          <Toaster position="top-right" />
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  // Render auth and legal pages without the app chrome (no sidebar/header)
  if (isPublicPage) {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  // Show loading state while auth is resolving
  if (authLoading) {
    return <RouteFallback />;
  }

  // Authenticated user with no org membership — create/join flow only
  // (shouldn't normally happen: registration creates the org in one step)
  if (isAuthenticated && needsOrganizationSelection) {
    return (
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/select-organization" element={<OrganizationSelectionPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="*" element={<Navigate to="/select-organization" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    );
  }

  // Show loading state while org is loading
  if (orgLoading) {
    return <RouteFallback />;
  }

  // Org list loaded but selection not applied yet (should be brief)
  if (isAuthenticated && !currentOrganization) {
    return <RouteFallback />;
  }

  return (
    <div
      className="dashboard-container"
      style={{ display: "flex", minHeight: "100vh" }}
    >
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div
          className="bg-background border-b border-border"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mobile-menu-btn text-foreground"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
            }}
          >
            <Menu style={{ width: 24, height: 24 }} />
          </button>
          {isAuthenticated && currentOrganization && (
            <div style={{ position: "relative" }} data-org-selector>
              <button
                onClick={() => setShowOrgSelector(!showOrgSelector)}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm hover:bg-accent transition-colors"
                style={{
                  cursor: "pointer",
                  maxWidth: "min(46vw, 320px)",
                }}
              >
                <Building2 style={{ width: 16, height: 16 }} />
                <span className="truncate">{currentOrganization.name}</span>
                <ChevronDown style={{ width: 16, height: 16 }} />
              </button>
              {showOrgSelector && (
                <div className="org-selector-menu absolute top-full left-0 mt-2 bg-popover text-popover-foreground border border-border rounded-lg w-[min(92vw,340px)] sm:min-w-[250px] shadow-lg z-[1000] overflow-hidden">
                  {organizations.map((org) => {
                    const isActive = org.id === currentOrganization.id;
                    const isDefault = isDefaultOrganization(org.id);
                    return (
                    <button
                      key={org.id}
                      onClick={() => {
                        setCurrentOrganization(org);
                        setShowOrgSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm border-b border-border last:border-b-0 transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-popover text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium break-words">{org.name}</div>
                        {isDefault && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs shrink-0 ${
                              isActive
                                ? "text-primary-foreground/90"
                                : "text-muted-foreground"
                            }`}
                            title="Default organization on sign-in"
                          >
                            <Star className="w-3 h-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          isActive
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        Role: {org.role}
                      </div>
                      {!isDefault && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDefaultOrganization(org);
                            setShowOrgSelector(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setDefaultOrganization(org);
                              setShowOrgSelector(false);
                            }
                          }}
                          className={`inline-block mt-2 text-xs underline-offset-2 hover:underline ${
                            isActive
                              ? "text-primary-foreground/90"
                              : "text-primary"
                          }`}
                        >
                          Set as default
                        </span>
                      )}
                    </button>
                    );
                  })}
                  <Link
                    to="/organization-settings"
                    onClick={() => setShowOrgSelector(false)}
                    className="block px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-t border-border no-underline"
                  >
                    Manage Organizations
                  </Link>
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }} />
          {isAuthenticated && user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: 0,
              }}
            >
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div
                className="relative"
                data-user-menu
                style={{ minWidth: 0, maxWidth: "min(60vw, 280px)" }}
              >
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-muted hover:bg-accent transition-colors cursor-pointer max-w-full"
                >
                  <UserAvatar profile={{ email: user.email }} size={30} />
                  <div className="hidden sm:block min-w-0 text-right">
                    <p
                      className="text-foreground truncate"
                      style={{ fontSize: 13, fontWeight: 500, margin: 0, maxWidth: 160 }}
                    >
                      {getDisplayName({ email: user.email }, user.email?.split("@")[0] ?? "User")}
                    </p>
                    {user.email && (
                      <p
                        className="text-muted-foreground truncate"
                        style={{ fontSize: 11, margin: 0, maxWidth: 160 }}
                      >
                        {user.email}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                </button>
                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-[min(88vw,240px)] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-[1000] overflow-hidden">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground transition-colors no-underline"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/organization-settings"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground transition-colors no-underline border-t border-border"
                    >
                      Organization settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        void logout();
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border-t border-border"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md bg-muted hover:bg-accent transition-colors"
                style={{
                  textDecoration: "none",
                }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 text-xs font-medium text-white border-none rounded-md bg-primary hover:bg-primary/90 transition-colors"
                style={{
                  textDecoration: "none",
                }}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes key={currentOrganization?.id ?? "app"}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/select-organization"
              element={<OrganizationSelectionPage />}
            />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            {isAuthenticated && currentOrganization ? (
              <>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/agents/:agentId" element={<AgentDetailPage />} />
                <Route path="/agents" element={<AgentsForm />} />
                <Route path="/agent" element={<AgentsForm />} />
                <Route path="/products" element={<ProductsForm />} />
                <Route path="/forms" element={<FormsForm />} />
                <Route
                  path="/forms/create"
                  element={
                    <ProtectedRoute permission={{ resource: "forms", action: "canCreate" }}>
                      <FormBuilderPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/forms/:id/edit"
                  element={
                    <ProtectedRoute permission={{ resource: "forms", action: "canUpdate" }}>
                      <FormBuilderPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/orders" element={<OrdersForm />} />
                <Route path="/abandoned-carts" element={<AbandonedCartsForm />} />
                <Route path="/follow-ups" element={<FollowUpsForm />} />
                <Route path="/expenses" element={<UnifiedExpensesForm />} />
                <Route
                  path="/crs"
                  element={<Navigate to="/expenses?tab=agent" replace />}
                />
                <Route path="/waybills" element={<DeliveriesForm />} />
                <Route
                  path="/delivery-analytics"
                  element={<DeliveryAnalyticsPage />}
                />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/inventory" element={<InventoryForm />} />
                <Route path="/staff/:staffId" element={<StaffDetailPage />} />
                <Route path="/staff" element={<StaffForm />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/strikes" element={<StrikesPage />} />
                <Route path="/stars" element={<StarsPage />} />
                <Route path="/leave" element={<LeavePage />} />
                <Route path="/order-assignment" element={<OrderAssignmentPage />} />
                <Route path="/media-buyers" element={<MediaBuyersPage />} />
                <Route path="/crm" element={<CrmPage />} />
                <Route
                  path="/integrations"
                  element={
                    <PlaceholderPage
                      title="Integrations"
                      description="Connect email, SMS, payment gateway, Meta Pixel, and Conversion API. Phase 1 placeholder."
                    />
                  }
                />
                <Route path="/invoicing" element={<InvoicingPage />} />
                <Route path="/accounting" element={<AccountingPage />} />
                <Route
                  path="/funnel-analytics"
                  element={
                    <PlaceholderPage
                      title="Funnel Analytics"
                      description="Per-funnel ad performance: spend, orders, delivery rate, CPA, and profit. Coming in Phase 2."
                    />
                  }
                />
                <Route
                  path="/business-analytics"
                  element={
                    <PlaceholderPage
                      title="Business Analytics"
                      description="Business-level ROAS vs ROI across all funnels. Coming in Phase 2."
                    />
                  }
                />
                {/* Legacy paths → new structure (Developer Brief §03) */}
                <Route
                  path="/remittance"
                  element={<Navigate to="/wallet" replace />}
                />
                <Route
                  path="/reports"
                  element={<Navigate to="/delivery-analytics" replace />}
                />
                <Route
                  path="/summary"
                  element={<Navigate to="/delivery-analytics" replace />}
                />
                <Route
                  path="/automation"
                  element={<Navigate to="/integrations" replace />}
                />
                <Route
                  path="/waybill-statistics"
                  element={<Navigate to="/delivery-analytics" replace />}
                />
                <Route
                  path="/import"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin", "Manager"]}>
                      <ImportWaybills />
                    </ProtectedRoute>
                  }
                />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/organization-settings"
                  element={<OrganizationSettingsPage />}
                />
                <Route
                  path="/storefront/site-settings"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin"]}>
                      <SiteSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storefront/payment-settings"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin"]}>
                      <PaymentSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storefront/delivery-settings"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin"]}>
                      <DeliverySettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storefront/analytics-settings"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin"]}>
                      <AnalyticsSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storefront/builder"
                  element={
                    <ProtectedRoute roles={["Owner", "Admin"]}>
                      <StorefrontBuilderPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}
          </Routes>
        </Suspense>
        </RouteErrorBoundary>
        <Toaster position="top-right" />
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
