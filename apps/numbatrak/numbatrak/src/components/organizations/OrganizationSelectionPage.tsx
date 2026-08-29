import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useOrganization } from "../../contexts/OrganizationContext";
import { OrganizationInvitation, OrganizationWithRole } from "../../types/organization";
import { createOrganization } from "../../services/organizations";
import { fetchMyPendingInvitations, acceptInvitation } from "../../services/organizationInvitations";
import { Building2, Plus, ArrowRight, Mail, CheckCircle, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { LottieLoader } from "../ui/LottieLoader";
import { LoadingState } from "../ui/LoadingState";
import { NumbatrakLogo } from "../brand/NumbatrakLogo";
import "./OrganizationSelectionPage.css";

export function OrganizationSelectionPage() {
  const navigate = useNavigate();
  const { switchOrganization } = useAuth();
  const { organizations, loading } = useOrganization();
  const { theme } = useTheme();
  const logoVariant = theme === "light" ? "onLight" : "onDark";
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [acceptingInvitation, setAcceptingInvitation] = useState<string | null>(null);

  useEffect(() => {
    // Load pending invitations when user has no organizations
    if (!loading && organizations.length === 0) {
      loadPendingInvitations();
    }
  }, [organizations.length, loading]);

  const loadPendingInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const invitations = await fetchMyPendingInvitations();
      setPendingInvitations(invitations);
    } catch (err: any) {
      console.error("Error loading pending invitations:", err);
      // Don't show error for invitations - just log it
      setPendingInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (invitation: OrganizationInvitation) => {
    try {
      setAcceptingInvitation(invitation.id);
      setError(null);

      const result = await acceptInvitation(invitation.id);

      if (result.success && result.organization_id) {
        await switchOrganization(result.organization_id);
        navigate("/", { replace: true });
        return;
      }
      if (!result.success) {
        setError(result.error || "Failed to accept invitation");
      }

      // Reload invitations to update the list
      await loadPendingInvitations();
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      setError(err.message || "Failed to accept invitation");
    } finally {
      setAcceptingInvitation(null);
    }
  };

  const handleSelectOrganization = async (org: OrganizationWithRole) => {
    try {
      await switchOrganization(org.id);
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error selecting organization:", err);
      setError(err.message || "Failed to select organization");
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setError("Organization name is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const newOrg = await createOrganization(newOrgName.trim());
      await switchOrganization(newOrg.id);
      setShowCreateForm(false);
      setNewOrgName("");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error creating organization:", err);
      // Provide user-friendly error messages
      if (err.message?.includes('Network error') || err.message?.includes('Failed to fetch')) {
        setError(
          "Unable to connect to the server. Please check your internet connection and try again."
        );
      } else if (err.message?.includes('row-level security')) {
        setError(
          "Permission denied. Please ensure you have the necessary permissions or contact your administrator."
        );
      } else {
        setError(err.message || "Failed to create organization");
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="org-selection-container">
        <div className="org-selection-content">
          <LottieLoader size={120} message="Loading organizations..." />
        </div>
      </div>
    );
  }

  return (
    <div className="org-selection-container">
      <div className="org-selection-content">
        <div className="org-selection-header">
          <div className="org-selection-icon mb-2 flex justify-center">
            <NumbatrakLogo size="md" variant={logoVariant} showWordmark />
          </div>
          <h1 className="org-selection-title">Select organization</h1>
          <p className="org-selection-subtitle">
            Choose an organization to continue, or create a new one
          </p>
        </div>

        {error && (
          <div className="org-selection-error">
            {error}
          </div>
        )}

        {!showCreateForm ? (
          <>
            {organizations.length > 0 ? (
              <div className="org-selection-list">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrganization(org)}
                    className="org-selection-card"
                  >
                    <div className="org-selection-card-content">
                      <Building2 className="w-6 h-6 text-primary" />
                      <div className="org-selection-card-text">
                        <h3 className="org-selection-card-title">{org.name}</h3>
                        <p className="org-selection-card-role">
                          Your role: <span className="font-semibold">{org.role}</span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <>
                {/* Show pending invitations if user has no organizations */}
                {loadingInvitations ? (
                  <div className="org-selection-empty">
                    <LoadingState label="Checking for invitations…" size="md" className="py-4" />
                  </div>
                ) : pendingInvitations.length > 0 ? (
                  <div className="org-selection-invitations">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">
                          Pending Invitations
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        You have {pendingInvitations.length} pending invitation{pendingInvitations.length > 1 ? "s" : ""}. Accept one to join an organization.
                      </p>
                    </div>
                    <div className="space-y-3 mb-6">
                      {pendingInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="org-selection-invitation-card"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-foreground font-semibold mb-1">
                                {invitation.organization?.name || "Organization"}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Role: <span className="text-foreground font-medium">{invitation.role}</span>
                              </p>
                              {invitation.invited_by_user && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Invited by: {invitation.invited_by_user.full_name || invitation.invited_by_user.email}
                                </p>
                              )}
                              {invitation.expires_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAcceptInvitation(invitation)}
                            disabled={acceptingInvitation === invitation.id}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {acceptingInvitation === invitation.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Accepting...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Accept Invitation
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="org-selection-invitations-divider">
                      <p className="text-sm text-muted-foreground mb-4 text-center">
                        Or create a new organization if you don't want to accept any invitations
                      </p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="org-selection-create-btn w-full"
                      >
                        <Plus className="w-5 h-5" />
                        Create New Organization
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="org-selection-empty">
                    <Building2 className="w-16 h-16 org-selection-empty-icon mx-auto" />
                    <p className="org-selection-empty-text">
                      You're not a member of any organizations yet.
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="org-selection-create-btn"
                    >
                      <Plus className="w-5 h-5" />
                      Create New Organization
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <form onSubmit={handleCreateOrganization} className="org-selection-form">
            <div className="org-selection-form-group">
              <label htmlFor="org-name" className="org-selection-form-label">
                Organization Name
              </label>
              <input
                id="org-name"
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
                className="org-selection-form-input"
                required
                autoFocus
              />
            </div>
            <div className="org-selection-form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewOrgName("");
                  setError(null);
                }}
                className="org-selection-form-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newOrgName.trim()}
                className="org-selection-form-submit"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Organization
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

