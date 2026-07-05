import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MfaStatusResponse, UserTenantMembership } from "@platform/shared-types";
import { authApi } from "../lib/authApi";
import { apiRequest, ApiError } from "../lib/apiClient";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  email: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  currentTenant: UserTenantMembership | null;
  refreshCurrentTenant: () => Promise<void>;
  accessToken: string | null;
  mfaStatus: MfaStatusResponse | null;
  refreshMfaStatus: () => Promise<void>;
  setSession: (accessToken: string) => void;
  logout: () => Promise<void>;
  /** Issues a request with the current access token, retrying once after a silent refresh on 401. */
  authorizedRequest: <T>(path: string, options?: RequestOptions) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusResponse | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentTenant, setCurrentTenant] = useState<UserTenantMembership | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const loadMfaStatus = useCallback(async (token: string) => {
    try {
      const nextStatus = await authApi.mfaStatus(token);
      setMfaStatus(nextStatus);
    } catch {
      // Non-fatal - security settings screens will retry on their own.
    }
  }, []);

  const loadMe = useCallback(async (token: string) => {
    try {
      const me = await authApi.me(token);
      setUser({ id: me.id, email: me.email });
      // Tenant-switching is out of scope - a member's first (and, in
      // practice, only) tenant is treated as "the" active tenant.
      setCurrentTenant(me.tenants[0] ?? null);
    } catch {
      // Non-fatal - dashboard screens that need a tenant will surface their own error.
    }
  }, []);

  const setSession = useCallback(
    (token: string) => {
      setAccessToken(token);
      setStatus("authenticated");
      void loadMfaStatus(token);
      void loadMe(token);
    },
    [loadMfaStatus, loadMe],
  );

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setMfaStatus(null);
    setUser(null);
    setCurrentTenant(null);
    setStatus("unauthenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    authApi
      .refresh()
      .then(({ accessToken: token }) => {
        if (!cancelled) setSession(token);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
    // Runs once on mount - this is the "silent refresh before rendering protected routes" step.
  }, []);

  const authorizedRequest = useCallback(
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, accessToken: accessTokenRef.current });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && accessTokenRef.current) {
          try {
            const { accessToken: refreshed } = await authApi.refresh();
            setAccessToken(refreshed);
            return await apiRequest<T>(path, { ...options, accessToken: refreshed });
          } catch {
            clearSession();
            throw error;
          }
        }
        throw error;
      }
    },
    [clearSession],
  );

  const refreshMfaStatus = useCallback(async () => {
    if (accessTokenRef.current) {
      await loadMfaStatus(accessTokenRef.current);
    }
  }, [loadMfaStatus]);

  const refreshCurrentTenant = useCallback(async () => {
    if (accessTokenRef.current) {
      await loadMe(accessTokenRef.current);
    }
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      currentTenant,
      refreshCurrentTenant,
      accessToken,
      mfaStatus,
      refreshMfaStatus,
      setSession,
      logout,
      authorizedRequest,
    }),
    [
      status,
      user,
      currentTenant,
      refreshCurrentTenant,
      accessToken,
      mfaStatus,
      refreshMfaStatus,
      setSession,
      logout,
      authorizedRequest,
    ],
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
