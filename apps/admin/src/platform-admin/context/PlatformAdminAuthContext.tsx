import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  platformAdminAuthApi,
  type PlatformAdminSessionUser,
} from "../lib/platformAdminAuthApi";

export type PlatformAdminAuthStatus = "loading" | "authenticated" | "unauthenticated";

interface PlatformAdminAuthContextValue {
  status: PlatformAdminAuthStatus;
  admin: PlatformAdminSessionUser | null;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAdminAuthContext = createContext<PlatformAdminAuthContextValue | null>(null);

export function PlatformAdminAuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<PlatformAdminAuthStatus>("loading");
  const [admin, setAdmin] = useState<PlatformAdminSessionUser | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const session = await platformAdminAuthApi.getSession();
      if (session) {
        setAdmin(session.user);
        setStatus("authenticated");
      } else {
        setAdmin(null);
        setStatus("unauthenticated");
      }
    } catch {
      setAdmin(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refreshMe();
    // Runs once on mount - only ever talks to /platform-admin/auth/*, never
    // the tenant-member /auth/me, so this session can't get confused with
    // (or accidentally piggyback on) a tenant-member or customer session.
  }, [refreshMe]);

  const logout = useCallback(async () => {
    try {
      await platformAdminAuthApi.logout();
    } finally {
      setAdmin(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<PlatformAdminAuthContextValue>(
    () => ({ status, admin, refreshMe, logout }),
    [status, admin, refreshMe, logout],
  );

  return (
    <PlatformAdminAuthContext.Provider value={value}>{children}</PlatformAdminAuthContext.Provider>
  );
}

export function usePlatformAdminAuth(): PlatformAdminAuthContextValue {
  const ctx = useContext(PlatformAdminAuthContext);
  if (!ctx) {
    throw new Error("usePlatformAdminAuth must be used within a PlatformAdminAuthProvider");
  }
  return ctx;
}
