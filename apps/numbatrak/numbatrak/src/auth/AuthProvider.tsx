import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, type AuthUser, type UserOrganizationMembership } from "../lib/authApi";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  organizations: UserOrganizationMembership[];
  activeOrganizationId: string | null;
  refreshMe: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganizationMembership[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me.user);
      setOrganizations(me.organizations);
      setActiveOrganizationId(me.activeOrganizationId);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setOrganizations([]);
      setActiveOrganizationId(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      await authApi.setActiveOrganization(organizationId);
      await refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setOrganizations([]);
      setActiveOrganizationId(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, organizations, activeOrganizationId, refreshMe, switchOrganization, logout }),
    [status, user, organizations, activeOrganizationId, refreshMe, switchOrganization, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
