"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, UserOrganizationMembership } from "@platform/shared-types";
import { authApi } from "../../lib/authApi";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  activeOrganization: UserOrganizationMembership | null;
  organizations: UserOrganizationMembership[];
  refreshMe: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
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

  const switchOrganization = useCallback(async (organizationId: string) => {
    await authApi.setActiveOrganization(organizationId);
    await refreshMe();
  }, [refreshMe]);

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

  const activeOrganization = useMemo(
    () => organizations.find((o) => o.id === activeOrganizationId) ?? organizations[0] ?? null,
    [organizations, activeOrganizationId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, activeOrganization, organizations, refreshMe, switchOrganization, logout }),
    [status, user, activeOrganization, organizations, refreshMe, switchOrganization, logout],
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
