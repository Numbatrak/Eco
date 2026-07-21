import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { auth, googleAuthProvider } from "../firebase";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error?: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function GoogleAuthProviderWrapper({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (e) {
      console.error("Google sign-in failed", e);
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      setLoading(true);
      await signOut(auth);
    } catch (e) {
      console.error("Sign out failed", e);
      setError("Sign out failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within GoogleAuthProviderWrapper");
  }
  return ctx;
}

export function GoogleSignInButton() {
  const { login, loading } = useAuth();

  return (
    <button
      onClick={() => login()}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? "Signing in..." : "Continue with Google"}
    </button>
  );
}
