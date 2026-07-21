import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { OrganizationWithRole } from "../types/organization";
import { fetchUserOrganizations } from "../services/organizations";
import { supabase } from "../supabaseClient";
import {
  resolveOrganization,
  setDefaultOrganizationId,
  clearDefaultOrganizationId,
  isDefaultOrganization,
} from "../utils/defaultOrganization";
import { isInvalidRefreshTokenError } from "../utils/authErrors";

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

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, loading: authLoading } = useSupabaseAuth();
  const [currentOrganization, setCurrentOrganizationState] =
    useState<OrganizationWithRole | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

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
      setCurrentOrganizationState(org);
      if (org) {
        persistDefault(org);
      }
    },
    [persistDefault],
  );

  const setDefaultOrganization = useCallback(
    (org: OrganizationWithRole) => {
      setCurrentOrganizationState(org);
      persistDefault(org);
    },
    [persistDefault],
  );

  const checkIsDefault = useCallback(
    (orgId: string) => isDefaultOrganization(user?.id, orgId),
    [user?.id],
  );

  const loadOrganizations = useCallback(async () => {
    // Wait until auth has finished — prevents false "no org" on first paint
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isAuthenticated || !user?.id) {
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError && isInvalidRefreshTokenError(sessionError)) {
      await supabase.auth.signOut();
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      return;
    }

    if (!session) {
      setOrganizations([]);
      setCurrentOrganizationState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const orgs = await fetchUserOrganizations();
      setOrganizations(orgs);

      setCurrentOrganizationState((prev) => {
        const resolved = resolveOrganization(orgs, user.id, prev);
        if (resolved) {
          setDefaultOrganizationId(user.id, resolved.id);
        }
        return resolved;
      });
    } catch (error: unknown) {
      console.error("Error loading organizations:", error);
      if (isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut();
        setOrganizations([]);
        setCurrentOrganizationState(null);
        return;
      }
      // Keep prior org if refresh fails — don't send user to org picker on transient errors
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  const needsOrganizationSelection =
    isAuthenticated &&
    !authLoading &&
    !loading &&
    organizations.length === 0 &&
    !currentOrganization;

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        loading: loading || authLoading,
        needsOrganizationSelection,
        setCurrentOrganization,
        setDefaultOrganization,
        isDefaultOrganization: checkIsDefault,
        refreshOrganizations: loadOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider",
    );
  }
  return context;
}
