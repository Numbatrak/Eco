import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import { useOrganization } from "../../contexts/OrganizationContext";
import { acceptInvitation, fetchMyPendingInvitations } from "../../services/organizationInvitations";
import { OrganizationInvitation } from "../../types/organization";
import { Building2, CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { LoadingState } from "../ui/LoadingState";
import { isInvalidRefreshTokenError } from "../../utils/authErrors";

function invitationReturnPath(code: string | null): string {
  return code
    ? `/accept-invitation?code=${encodeURIComponent(code)}`
    : "/accept-invitation";
}

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, signOut } = useSupabaseAuth();
  const { refreshOrganizations } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<OrganizationInvitation | null>(null);
  const autoAcceptStarted = useRef(false);

  const goToLogin = useCallback(() => {
    const returnPath = invitationReturnPath(code);
    navigate(`/login?redirect=${encodeURIComponent(returnPath)}`, { replace: true });
  }, [code, navigate]);

  const handleAuthFailure = useCallback(
    async (err: unknown) => {
      if (!isInvalidRefreshTokenError(err)) return false;
      console.warn("Session expired on accept-invitation page:", err);
      await signOut();
      setError("Your session expired. Please log in again to accept this invitation.");
      return true;
    },
    [signOut],
  );

  const loadPendingInvitations = useCallback(async () => {
    try {
      const invitations = await fetchMyPendingInvitations();
      setPendingInvitations(invitations);
      if (invitations.length > 0) {
        setSelectedInvitation(invitations[0]);
      }
    } catch (err: unknown) {
      if (await handleAuthFailure(err)) return;
      console.error("Error loading invitations:", err);
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load invitations: ${message}`);
    }
  }, [handleAuthFailure]);

  const handleAcceptCode = useCallback(
    async (invitationCode: string) => {
      if (!isAuthenticated) {
        setError("Please log in to accept the invitation");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await acceptInvitation(invitationCode);

        if (result.success) {
          setSuccess(true);
          await refreshOrganizations();
          await loadPendingInvitations();
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 2000);
        } else {
          setError(result.error || "Failed to accept invitation");
        }
      } catch (err: unknown) {
        if (await handleAuthFailure(err)) return;
        console.error("Error accepting invitation:", err);
        const message =
          err instanceof Error ? err.message : "Failed to accept invitation";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      isAuthenticated,
      refreshOrganizations,
      loadPendingInvitations,
      navigate,
      handleAuthFailure,
    ],
  );

  useEffect(() => {
    if (authLoading) return;

    if (code && isAuthenticated) {
      if (autoAcceptStarted.current) return;
      autoAcceptStarted.current = true;
      void handleAcceptCode(code);
      return;
    }

    if (isAuthenticated) {
      void loadPendingInvitations();
    }
  }, [
    code,
    isAuthenticated,
    authLoading,
    handleAcceptCode,
    loadPendingInvitations,
  ]);

  const handleAcceptInvitation = async (invitation: OrganizationInvitation) => {
    await handleAcceptCode(invitation.invitation_code);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background p-4">
        <LoadingState label="Checking your session…" size="md" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background p-4">
        <div className="w-full max-w-md min-w-0 rounded-lg border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <Mail className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="mb-2 text-2xl font-semibold text-foreground">
              Accept Invitation
            </h1>
            <p className="text-muted-foreground">
              Please log in to accept the organization invitation
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goToLogin}
              className="flex-1 rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/signup?redirect=${encodeURIComponent(invitationReturnPath(code))}`,
                  { replace: true },
                )
              }
              className="flex-1 rounded border border-border bg-muted px-4 py-2 text-foreground transition-colors hover:bg-accent"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background p-4">
        <div className="w-full max-w-md min-w-0 rounded-lg border border-border bg-card p-8 text-center shadow-lg">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="mb-2 text-2xl font-semibold text-foreground">
            Invitation Accepted!
          </h1>
          <p className="mb-6 text-muted-foreground">
            You have successfully joined the organization. Redirecting...
          </p>
          <LoadingState label="Redirecting…" size="sm" className="py-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-background p-4">
      <div className="w-full max-w-md min-w-0 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="mb-2 text-2xl font-semibold text-foreground">
            Accept Invitation
          </h1>
          <p className="text-muted-foreground">
            {code
              ? "Accept the invitation to join the organization"
              : "Select an invitation to accept"}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            {error.includes("session expired") && (
              <button
                type="button"
                onClick={goToLogin}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Log in again
              </button>
            )}
          </div>
        )}

        {code ? (
          <div className="space-y-4">
            <div className="min-w-0 rounded-lg border border-border bg-muted/40 p-4">
              <p className="mb-1 text-sm text-muted-foreground">Invitation Code</p>
              <code className="block break-all font-mono text-base text-foreground sm:text-lg">
                {code}
              </code>
            </div>

            <button
              type="button"
              onClick={() => handleAcceptCode(code)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Accept Invitation
                </>
              )}
            </button>
          </div>
        ) : pendingInvitations.length > 0 ? (
          <div className="space-y-4">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                role="button"
                tabIndex={0}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  selectedInvitation?.id === invitation.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                }`}
                onClick={() => setSelectedInvitation(invitation)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedInvitation(invitation);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="mb-1 font-semibold text-foreground">
                      {invitation.organization?.name || "Organization"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Role:{" "}
                      <span className="text-foreground">{invitation.role}</span>
                    </p>
                    {invitation.invited_by_user && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Invited by:{" "}
                        {invitation.invited_by_user.full_name ||
                          invitation.invited_by_user.email}
                      </p>
                    )}
                    {invitation.expires_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expires:{" "}
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {selectedInvitation && (
              <button
                type="button"
                onClick={() => handleAcceptInvitation(selectedInvitation)}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Accept Invitation
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No pending invitations found</p>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="mt-4 text-primary transition-colors hover:text-primary/80"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
