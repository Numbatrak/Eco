import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { fetchMyPendingInvitations } from "../services/organizationInvitations";
import {
  NAV_GROUPS,
  isNavPathActive,
  type NavItemConfig,
} from "../config/navigation";
import { BrandTagline } from "./brand/BrandTagline";
import { NumbatrakLogo } from "./brand/NumbatrakLogo";
import "./Sidebar.css";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === "light" ? "onLight" : "onDark";
  const location = useLocation();
  const { hasPermission, hasAnyRole } = usePermissions();
  const { isAuthenticated, signOut } = useSupabaseAuth();
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      loadPendingInvitations();
    }
  }, [isAuthenticated]);

  const loadPendingInvitations = async () => {
    try {
      const invitations = await fetchMyPendingInvitations();
      setPendingInvitationsCount(invitations.length);
    } catch (err) {
      console.error("Error loading pending invitations:", err);
    }
  };

  const isItemVisible = (item: NavItemConfig): boolean => {
    if (item.showWhenPendingInvitations && pendingInvitationsCount === 0) {
      return false;
    }
    if (item.requiredRoles && !hasAnyRole(item.requiredRoles)) {
      return false;
    }
    if (!item.requiredPermission) {
      return true;
    }
    if (item.id === "expenses") {
      return (
        hasPermission("generalExpenses", "canView") ||
        hasPermission("expenses", "canView")
      );
    }
    return hasPermission(
      item.requiredPermission.resource,
      item.requiredPermission.action
    );
  };

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(isItemVisible),
      })).filter((group) => group.items.length > 0),
    [location.pathname, pendingInvitationsCount, hasPermission, hasAnyRole]
  );

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="flex flex-col gap-1">
            <NumbatrakLogo size="md" variant={logoVariant} showWordmark />
            <BrandTagline className="pl-[2px] text-[11px] tracking-normal" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group) => (
            <div key={group.id} className="sidebar-section">
              <p className="sidebar-section-title">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isNavPathActive(location.pathname, item.path);
                const badge =
                  item.id === "accept-invitation" && pendingInvitationsCount > 0
                    ? pendingInvitationsCount
                    : undefined;

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                    onClick={onClose}
                  >
                    <Icon className="sidebar-nav-item-icon" />
                    <span className="sidebar-nav-item-text">{item.label}</span>
                    {badge != null && badge > 0 && (
                      <span className="sidebar-nav-badge">{badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          <div className="sidebar-section sidebar-section-footer">
            <button
              type="button"
              className="sidebar-nav-item sidebar-sign-out-btn"
              onClick={() => {
                onClose?.();
                void signOut();
              }}
            >
              <LogOut className="sidebar-nav-item-icon" />
              <span className="sidebar-nav-item-text">Sign out</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
