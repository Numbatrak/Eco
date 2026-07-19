"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { authApi, type OrgInvitation } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";

function AcceptInviteInner(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("id");
  const { refreshMe } = useAuth();

  const [invitation, setInvitation] = useState<OrgInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const fetchInvitation = useCallback(async () => {
    if (!invitationId) {
      setError("No invitation ID provided.");
      setLoading(false);
      return;
    }
    try {
      const inv = await authApi.getInvitation(invitationId);
      if (inv.status !== "pending") {
        setError(inv.status === "accepted" ? "This invitation has already been accepted." : "This invitation is no longer valid.");
      } else if (new Date(inv.expiresAt) < new Date()) {
        setError("This invitation has expired.");
      } else {
        setInvitation(inv);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invitation.");
    } finally {
      setLoading(false);
    }
  }, [invitationId]);

  useEffect(() => {
    void fetchInvitation();
  }, [fetchInvitation]);

  async function handleAccept(): Promise<void> {
    if (!invitationId) return;
    setAccepting(true);
    setError(null);
    try {
      await authApi.acceptInvitation(invitationId);
      await refreshMe();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept invitation.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return <AuthLayout title="Invitation" subtitle="Loading…"><p className="field-hint">Checking invitation…</p></AuthLayout>;
  }

  if (error) {
    return (
      <AuthLayout title="Invitation" subtitle="Something went wrong.">
        <div className="form-error">{error}</div>
        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: "var(--space-4)" }} onClick={() => router.replace("/dashboard")}>
          Go to dashboard
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="You're invited" subtitle={`Join as ${invitation?.role ?? "a team member"}.`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <p>You've been invited to join an organization as <strong>{invitation?.role ?? "viewer"}</strong>.</p>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={accepting} onClick={() => void handleAccept()}>
            {accepting ? "Accepting…" : "Accept invitation"}
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.replace("/dashboard")}>
            Decline
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function AcceptInvitePage(): React.ReactElement {
  return (
    <RequireAuth>
      <AcceptInviteInner />
    </RequireAuth>
  );
}
