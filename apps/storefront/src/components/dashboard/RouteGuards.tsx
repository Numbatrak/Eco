"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

export function FullPageSpinner(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "#8a8271" }}>Loading…</span>
    </div>
  );
}

/** Redirects unauthenticated users to /dashboard/login; renders children otherwise. */
export function RequireAuth({ children }: { children: ReactNode }): React.ReactElement | null {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/dashboard/login");
    }
  }, [status, router]);

  if (status === "loading") return <FullPageSpinner />;
  if (status === "unauthenticated") return null;
  return <>{children}</>;
}

/** Redirects already-authenticated users away from auth pages. */
export function RequireGuest({ children }: { children: ReactNode }): React.ReactElement | null {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") return <FullPageSpinner />;
  if (status === "authenticated") return null;
  return <>{children}</>;
}
