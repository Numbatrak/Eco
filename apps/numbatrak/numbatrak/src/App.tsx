import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { Menu, Building2, ChevronDown, Moon, Sun, Star } from "lucide-react";
import { useSupabaseAuth } from "./auth/SupabaseAuthProvider";
import { getDisplayName } from "./utils/userDisplay";
import { UserAvatar } from "./components/profile/UserAvatar";
import { ProfilePage } from "./components/profile/ProfilePage";
import { useOrganization } from "./contexts/OrganizationContext";
import { useTheme } from "next-themes";
import AgentsForm from "./components/AgentsForm";
import AgentDetailPage from "./components/agents/AgentDetailPage";
import ProductsForm from "./components/ProductsForm";
import FormsForm from "./components/FormsForm";
import FormBuilderPage from "./components/forms/FormBuilderPage";
import DeliveriesForm from "./components/DeliveriesForm";
import { DeliveryAnalyticsPage } from "./components/deliveryAnalytics/DeliveryAnalyticsPage";
import { WalletPage } from "./components/wallet/WalletPage";
import { PlaceholderPage } from "./components/PlaceholderPage";
import InventoryForm from "./components/InventoryForm";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { EmailVerificationPage } from "./components/EmailVerificationPage";
import { ForgotPasswordPage } from "./components/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { TermsOfServicePage } from "./components/TermsOfServicePage";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import { ImportWaybills } from "./components/ImportWaybills";
import UnifiedExpensesForm from "./components/UnifiedExpensesForm";
import OrdersForm from "./components/OrdersForm";
import AbandonedCartsForm from "./components/AbandonedCartsForm";
import FollowUpsForm from "./components/FollowUpsForm";
import { FollowUpNotifications } from "./components/followUps/FollowUpNotifications";
import { OrganizationSelectionPage } from "./components/organizations/OrganizationSelectionPage";
import { OrganizationSettingsPage } from "./components/organizations/OrganizationSettingsPage";
import { AcceptInvitationPage } from "./components/organizations/AcceptInvitationPage";
import { InvitationNotification } from "./components/organizations/InvitationNotification";
import { DashboardAlertsProvider } from "./contexts/DashboardAlertsContext";
import { DashboardNotificationBell } from "./components/dashboard/DashboardNotificationBell";
import { FaviconPreloader } from "./components/ui/FaviconPreloader";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Toaster } from "./components/ui/sonner";
import { useState, useEffect } from "react";
import "./components/Dashboard.css";

function AppContent() {
  const {
    isAuthenticated,
    user,
    userProfile,
    emailVerified,
    profileLoaded,
    signOut,
    loading: authLoading,
  } = useSupabaseAuth();
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

  const emailVerificationRedirect = () => {
    const params = new URLSearchParams({ from: "login" });
    const returnPath = `${location.pathname}${location.search}`;
    if (
      returnPath &&
      returnPath !== "/verify-email" &&
      returnPath !== "/login" &&
      returnPath !== "/signup"
    ) {
      params.set("redirect", returnPath);
    }
    return `/verify-email?${params.toString()}`;
  };

  // Accept invitation works logged in or out — no org chrome required
  if (isAcceptInvitationPage) {
    if (authLoading || (isAuthenticated && !profileLoaded)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
          <FaviconPreloader size={80} />
        </div>
      );
    }
    if (isAuthenticated && !emailVerified) {
      return <Navigate to={emailVerificationRedirect()} replace />;
    }
    return (
      <>
        <Routes>
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="*" element={<Navigate to="/accept-invitation" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  // Render auth and legal pages without the app chrome (no sidebar/header)
  if (isPublicPage) {
    return (
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
    );
  }

  // Show loading state while auth or org is loading
  if (authLoading || (isAuthenticated && !profileLoaded)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <FaviconPreloader size={80} />
      </div>
    );
  }

  // Block app access until email is verified (OTP flow)
  if (isAuthenticated && !emailVerified) {
    return <Navigate to={emailVerificationRedirect()} replace />;
  }

  // Show loading state while org is loading
  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <FaviconPreloader size={80} />
      </div>
    );
  }

  // Authenticated user with no org membership — create/join flow only
  if (isAuthenticated && needsOrganizationSelection) {
    return (
      <Routes>
        <Route
          path="/select-organization"
          element={<OrganizationSelectionPage />}
        />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route
          path="*"
          element={<Navigate to="/select-organization" replace />}
        />
      </Routes>
    );
  }

  // Org list loaded but selection not applied yet (should be brief)
  if (isAuthenticated && !currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <FaviconPreloader size={80} />
      </div>
    );
  }

  return (
    <div
      className="dashboard-container"
      style={{ display: "flex", minHeight: "100vh" }}
    >
      {isAuthenticated && <FollowUpNotifications />}
      {isAuthenticated && <InvitationNotification />}
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
              <DashboardNotificationBell />
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
                  <UserAvatar
                    profile={userProfile ?? { email: user.email ?? null }}
                    size={30}
                  />
                  <div className="hidden sm:block min-w-0 text-right">
                    <p
                      className="text-foreground truncate"
                      style={{ fontSize: 13, fontWeight: 500, margin: 0, maxWidth: 160 }}
                    >
                      {getDisplayName(
                        userProfile ?? { email: user.email ?? null },
                        user.email?.split("@")[0] ?? "User"
                      )}
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
                        void signOut();
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
              <Route path="/" element={<DashboardPage />} />
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
              <Route
                path="/integrations"
                element={
                  <PlaceholderPage
                    title="Integrations"
                    description="Connect email, SMS, payment gateway, Meta Pixel, and Conversion API. Phase 1 placeholder."
                  />
                }
              />
              <Route
                path="/invoicing"
                element={
                  <PlaceholderPage
                    title="Invoicing"
                    description="Auto-generated invoices per order with PDF and WhatsApp sharing. Coming in Phase 2."
                  />
                }
              />
              <Route
                path="/accounting"
                element={
                  <PlaceholderPage
                    title="Accounting"
                    description="Business financial summary: revenue, expenses by category, and net profit. Coming in Phase 2."
                  />
                }
              />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
        <Toaster position="top-right" />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DashboardAlertsProvider>
      <AppContent />
    </DashboardAlertsProvider>
  );
}

