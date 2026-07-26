import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { OrganizationWithRole } from "../types/organization";
import { mapOrgRoleToUserRole } from "../utils/roleMapping";
import {
  setDefaultOrganizationId,
  clearDefaultOrganizationId,
  isDefaultOrganization,
} from "../utils/defaultOrganization";

interface OrganizationContextType {
  currentOrganization: OrganizationWithRole | null;
  organizations: OrganizationWithRole[];
  loading: boolean;
  needsOrganizationSelection: boolean;
  setCurrentOrganization: (org: OrganizationWithRole | null) => void;
  setDefaultOrganization: (org: OrganizationWithRole) => void;
  isDefaultOrganization: (orgId: string) => boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { status, user, organizations: memberships, activeOrganizationId, refreshMe, switchOrganization } =
    useAuth();
  const [switching, setSwitching] = useState(false);

  const organizations = useMemo<OrganizationWithRole[]>(
    () =>
      memberships.map((m) => ({
        id: m.id,
        name: m.name,
        logo_url: null,
        timezone: null,
        currency: null,
        created_at: null,
        updated_at: null,
        role: mapOrgRoleToUserRole(m.role),
      })),
    [memberships],
  );

  const currentOrganization = useMemo<OrganizationWithRole | null>(() => {
    if (organizations.length === 0) return null;
    return organizations.find((o) => o.id === activeOrganizationId) ?? organizations[0] ?? null;
  }, [organizations, activeOrganizationId]);

  const persistDefault = useCallback(
    (org: OrganizationWithRole | null) => {
      if (!user?.id) return;
      if (org) {
        setDefaultOrganizationId(user.id, org.id);
      } else {
        clearDefaultOrganizationId(user.id);
      }
    },
    [user?.id],
  );

  const setCurrentOrganization = useCallback(
    (org: OrganizationWithRole | null) => {
      if (!org || org.id === activeOrganizationId) return;
      persistDefault(org);
      setSwitching(true);
      void switchOrganization(org.id).finally(() => setSwitching(false));
    },
    [activeOrganizationId, persistDefault, switchOrganization],
  );

  const setDefaultOrganization = useCallback(
    (org: OrganizationWithRole) => {
      persistDefault(org);
    },
    [persistDefault],
  );

  const checkIsDefault = useCallback((orgId: string) => isDefaultOrganization(user?.id, orgId), [user?.id]);

  const loading = status === "loading" || switching;
  const needsOrganizationSelection = status === "authenticated" && organizations.length === 0;

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        loading,
        needsOrganizationSelection,
        setCurrentOrganization,
        setDefaultOrganization,
        isDefaultOrganization: checkIsDefault,
        refreshOrganizations: refreshMe,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
