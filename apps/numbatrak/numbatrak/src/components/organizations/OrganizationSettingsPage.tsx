import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../../contexts/ConfirmContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchOrganizationMembers,
  updateMemberRole,
  removeMember,
  updateOrganization,
} from "../../services/organizations";
import {
  fetchOrganizationInvitations,
  revokeInvitation,
  resendInvitation,
} from "../../services/organizationInvitations";
import { OrganizationMember } from "../../types/organization";
import { OrganizationInvitation } from "../../types/organization";
import { Building2, User, Shield, Trash2, Loader2, Settings, Mail, Plus, X, Copy, Check, Clock, Moon, Sun, Edit2, Save, Bell, UserCircle, CreditCard } from "lucide-react";
import { InvitationDialog } from "./InvitationDialog";
import { OrderAssignmentSettings } from "./OrderAssignmentSettings";
import { OrganizationBrandingSettings } from "./OrganizationBrandingSettings";
import { DashboardAlertThresholdsSettings } from "./DashboardAlertThresholdsSettings";
import { SubscriptionSection } from "./SubscriptionSection";
import { Switch } from "../ui/switch";
import { PageLayout } from "../layout/PageLayout";
import { getDisplayName } from "../../utils/userDisplay";
import "./OrganizationSettingsPage.css";
import { LoadingState } from "../ui/LoadingState";

export function OrganizationSettingsPage() {
  const { currentOrganization, organizations, setCurrentOrganization, setDefaultOrganization, isDefaultOrganization, refreshOrganizations } = useOrganization();
  const { confirm } = useConfirm();
  const { hasAnyRole } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<"Owner" | "Admin" | "Customer Relations" | "Manager">("Customer Relations");
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [savingOrgName, setSavingOrgName] = useState(false);

  const canManageMembers = hasAnyRole(["Owner", "Admin"]);
  const canEditOrganization = hasAnyRole(["Owner", "Admin"]);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);


  useEffect(() => {
    if (currentOrganization) {
      loadMembers();
      loadInvitations();
    }
  }, [currentOrganization]);

  const loadMembers = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setError(null);
      const membersData = await fetchOrganizationMembers(currentOrganization.id);
      setMembers(membersData);
    } catch (err: any) {
      console.error("Error loading members:", err);
      setError(err.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!currentOrganization) return;
    try {
      setLoadingInvitations(true);
      setInvitationError(null);
      const invitationsData = await fetchOrganizationInvitations(currentOrganization.id);
      setInvitations(invitationsData);
    } catch (err: unknown) {
      console.error("Error loading invitations:", err);
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setInvitationError(`Failed to load invitations: ${message}`);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: "Owner" | "Admin" | "Customer Relations" | "Manager") => {
    if (!currentOrganization) return;
    try {
      setError(null);
      await updateMemberRole(currentOrganization.id, userId, role);
      setSuccess("Role updated successfully!");
      await loadMembers();
      setEditingMember(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error updating role:", err);
      setError(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!currentOrganization) return;
    if (
      !(await confirm({
        title: `Remove ${userName}?`,
        description: `This will remove ${userName} from this organization. They will lose access immediately.`,
        confirmLabel: "Remove member",
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      setError(null);
      await removeMember(currentOrganization.id, userId);
      setSuccess("Member removed successfully!");
      await loadMembers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error removing member:", err);
      setError(err.message || "Failed to remove member");
    }
  };

  const handleSwitchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
    }
  };

  const handleInvitationCreated = (invitation: OrganizationInvitation) => {
    setSuccess(`Invitation sent successfully to ${invitation.email}!`);
    loadInvitations();
    setShowInvitationDialog(false);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!(await confirmDelete(confirm, "invitation", "The invitation link will no longer work."))) {
      return;
    }
    try {
      await revokeInvitation(invitationId);
      setSuccess("Invitation revoked successfully!");
      await loadInvitations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error revoking invitation:", err);
      setError(err.message || "Failed to revoke invitation");
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitation(invitationId, 7);
      setSuccess("Invitation resent successfully!");
      await loadInvitations();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error resending invitation:", err);
      setError(err.message || "Failed to resend invitation");
    }
  };

  const copyInvitationCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const copyInvitationLink = (code: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/accept-invitation?code=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setSuccess("Invitation link copied to clipboard!");
      setTimeout(() => setSuccess(null), 3000);
    });
  };

  const handleEditOrgName = () => {
    setNewOrgName(currentOrganization.name);
    setEditingOrgName(true);
  };

  const handleSaveOrgName = async () => {
    if (!currentOrganization || !newOrgName.trim()) {
      setError("Organization name cannot be empty");
      return;
    }
    try {
      setSavingOrgName(true);
      setError(null);
      await updateOrganization(currentOrganization.id, { name: newOrgName.trim() });
      setSuccess("Organization name updated successfully!");
      setCurrentOrganization({
        ...currentOrganization,
        name: newOrgName.trim(),
      });
      await refreshOrganizations();
      setEditingOrgName(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error updating organization name:", err);
      setError(err.message || "Failed to update organization name");
    } finally {
      setSavingOrgName(false);
    }
  };

  const handleCancelEditOrgName = () => {
    setEditingOrgName(false);
    setNewOrgName("");
  };

  if (!currentOrganization) {
    return (
      <div className="org-settings-container">
        <div className="org-settings-content">
          <p>No organization selected</p>
        </div>
      </div>
    );
  }

  const currentUserMember = members.find(m => m.user_id === currentOrganization.id);
  const isOwner = currentOrganization.role === "Owner";
  const isAdmin = currentOrganization.role === "Admin";

  return (
    <PageLayout className="org-settings-container">
      <div className="org-settings-content w-full">
        <div className="org-settings-header">
          <div className="org-settings-header-icon">
            <Settings className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="org-settings-title">Organization Settings</h1>
            <p className="org-settings-subtitle">Manage your organization and members</p>
          </div>
        </div>

        {/* User Preferences */}
        <div className="org-settings-section">
          <h2 className="org-settings-section-title">Preferences</h2>
          
          {/* Theme Settings */}
          <div className="org-settings-theme-toggle mb-4">
            <div className="org-settings-theme-info">
              <div className="org-settings-theme-icon">
                {mounted && (theme || "dark") === "dark" ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="org-settings-theme-label">Theme</h3>
                <p className="org-settings-theme-description">
                  {mounted && (theme || "dark") === "dark" ? "Dark mode" : "Light mode"}
                </p>
              </div>
            </div>
            {mounted ? (
              <Switch
                checked={(theme || "dark") === "dark"}
                onCheckedChange={(checked) => {
                  setTheme(checked ? "dark" : "light");
                }}
              />
            ) : (
              <div className="w-8 h-4 bg-muted rounded-full" />
            )}
          </div>

          {/* Notification Preferences (Placeholder) */}
          <div className="org-settings-theme-toggle">
            <div className="org-settings-theme-info">
              <div className="org-settings-theme-icon">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="org-settings-theme-label">Email Notifications</h3>
                <p className="org-settings-theme-description">
                  Receive email updates about important events
                </p>
              </div>
            </div>
            <Switch
              checked={true}
              onCheckedChange={() => {
                // Placeholder - will be implemented later
                setSuccess("Notification preferences will be saved soon!");
                setTimeout(() => setSuccess(null), 2000);
              }}
            />
          </div>
        </div>

        {/* Organization Selector */}
        {organizations.length > 1 && (
          <div className="org-settings-section">
            <h2 className="org-settings-section-title">Switch Organization</h2>
            <div className="org-settings-org-list">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrganization(org.id)}
                  className={`org-settings-org-item ${org.id === currentOrganization.id ? "active" : ""}`}
                >
                  <Building2 className="w-5 h-5" />
                  <div className="org-settings-org-item-text">
                    <span className="org-settings-org-item-name">
                      {org.name}
                      {isDefaultOrganization(org.id) && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (Default on sign-in)
                        </span>
                      )}
                    </span>
                    <span className="org-settings-org-item-role">Your role: {org.role}</span>
                  </div>
                  {!isDefaultOrganization(org.id) && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultOrganization(org);
                        setSuccess(`${org.name} is now your default organization.`);
                        setTimeout(() => setSuccess(null), 2500);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setDefaultOrganization(org);
                        }
                      }}
                      className="text-xs text-primary shrink-0 hover:underline"
                    >
                      Set default
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Organization Info */}
        <div className="org-settings-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="org-settings-section-title">Organization Details</h2>
            {canEditOrganization && !editingOrgName && (
              <button
                onClick={handleEditOrgName}
                className="org-settings-action-btn"
              >
                <Edit2 className="w-4 h-4" />
                Edit Name
              </button>
            )}
          </div>
          {editingOrgName ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-primary" />
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="org-settings-text-input flex-1"
                  placeholder="Organization name"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveOrgName}
                  disabled={savingOrgName || !newOrgName.trim()}
                  className="org-settings-save-btn flex items-center gap-2"
                >
                  {savingOrgName ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEditOrgName}
                  disabled={savingOrgName}
                  className="org-settings-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="org-settings-org-info">
              <Building2 className="w-6 h-6 text-primary" />
              <div className="flex-1">
                <h3 className="org-settings-org-name">{currentOrganization.name}</h3>
                <p className="org-settings-org-role">
                  Your role: <span className="font-semibold">{currentOrganization.role}</span>
                </p>
                {currentOrganization.created_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Created: {new Date(currentOrganization.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <OrganizationBrandingSettings
          organization={currentOrganization}
          canEdit={canEditOrganization}
          onUpdated={(org) => {
            setCurrentOrganization(org);
            void refreshOrganizations();
          }}
          onError={setError}
          onSuccess={(message) => {
            setSuccess(message);
            setTimeout(() => setSuccess(null), 3000);
          }}
        />

        {/* Global Error/Success Messages */}
        {(error || success) && (
          <div className="org-settings-section">
            {error && (
              <div className="org-settings-error">
                <X className="w-4 h-4 inline mr-2" />
                {error}
              </div>
            )}
            {success && (
              <div className="org-settings-success">
                <Check className="w-4 h-4 inline mr-2" />
                {success}
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="org-settings-section">
          <h2 className="org-settings-section-title">Members</h2>
          {loading ? (
            <LoadingState label="Loading members…" size="md" className="py-8" />
          ) : (
            <div className="org-settings-members-list">
              {members.map((member) => (
                <div key={member.id} className="org-settings-member-card">
                  <div className="org-settings-member-info">
                    <div className="org-settings-member-avatar">
                      {member.user?.avatar_url ? (
                        <img
                          src={member.user.avatar_url}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div className="org-settings-member-details">
                      <h3 className="org-settings-member-name">
                        {getDisplayName(
                          {
                            full_name: member.user?.full_name,
                            email: member.user?.email,
                          },
                          "Unknown user"
                        )}
                      </h3>
                      <p className="org-settings-member-email">
                        {member.user?.email || "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="org-settings-member-actions">
                    {editingMember === member.user_id ? (
                      <div className="org-settings-member-edit">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as any)}
                          className="org-settings-role-select"
                        >
                          <option value="Customer Relations">Customer Relations</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                          <option value="Owner">Owner</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole(member.user_id, newRole)}
                          className="org-settings-save-btn"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="org-settings-cancel-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="org-settings-member-role">
                          <Shield className="w-4 h-4" />
                          <span>{member.role}</span>
                        </div>
                        {canManageMembers && (
                          <div className="org-settings-member-buttons">
                            <button
                              onClick={() => {
                                setEditingMember(member.user_id);
                                setNewRole(member.role);
                              }}
                              className="org-settings-edit-btn"
                            >
                              Edit Role
                            </button>
                            {isOwner && member.role !== "Owner" && (
                              <button
                                onClick={() =>
                                  handleRemoveMember(
                                    member.user_id,
                                    getDisplayName(
                                      {
                                        full_name: member.user?.full_name,
                                        email: member.user?.email,
                                      },
                                      member.user?.email || "this user"
                                    )
                                  )
                                }
                                className="org-settings-remove-btn"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invitations Section */}
        {canManageMembers && (
          <div className="org-settings-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="org-settings-section-title">Invitation History</h2>
              <button
                onClick={() => setShowInvitationDialog(true)}
                className="org-settings-action-btn"
              >
                <Plus className="w-4 h-4" />
                Invite Member
              </button>
            </div>
            {invitationError && (
              <p className="text-sm text-destructive mb-3">{invitationError}</p>
            )}
            {loadingInvitations ? (
              <LoadingState label="Loading invitations…" size="md" className="py-8" />
            ) : invitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No invitations yet. Create your first invitation to get started.</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => {
                  const isExpired = invitation.expires_at
                    ? new Date(invitation.expires_at) < new Date()
                    : false;
                  const isAccepted = invitation.accepted_at !== null;
                  const createdDate = invitation.created_at 
                    ? new Date(invitation.created_at).toLocaleDateString() 
                    : 'Unknown';

                  return (
                    <div
                      key={invitation.id}
                      className={`org-settings-invitation-card ${
                        isAccepted
                          ? "org-settings-invitation-card--accepted"
                          : isExpired
                          ? "org-settings-invitation-card--expired"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground font-medium">{invitation.email}</span>
                            {isAccepted && (
                              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded">
                                Accepted
                              </span>
                            )}
                            {!isAccepted && isExpired && (
                              <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
                                Expired
                              </span>
                            )}
                            {!isAccepted && !isExpired && (
                              <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              Role: <span className="text-foreground">{invitation.role}</span>
                            </p>
                            <p>
                              Code:{" "}
                              <code className="text-primary font-mono text-xs">
                                {invitation.invitation_code}
                              </code>
                            </p>
                            <p>
                              Created:{" "}
                              <span className="text-foreground">{createdDate}</span>
                            </p>
                            {invitation.expires_at && (
                              <p>
                                Expires:{" "}
                                <span className="text-foreground">
                                  {new Date(invitation.expires_at).toLocaleDateString()}
                                </span>
                              </p>
                            )}
                            {invitation.accepted_at && (
                              <p>
                                Accepted:{" "}
                                <span className="text-foreground">
                                  {new Date(invitation.accepted_at).toLocaleDateString()}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                        {!isAccepted && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyInvitationCode(invitation.invitation_code)}
                              className="p-2 bg-accent hover:bg-accent/80 text-foreground rounded transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === invitation.invitation_code ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                            <button
                              onClick={() => copyInvitationLink(invitation.invitation_code)}
                              className="p-2 bg-accent hover:bg-accent/80 text-foreground rounded transition-colors"
                              title="Copy link"
                            >
                              <Mail className="w-4 h-4 text-muted-foreground" />
                            </button>
                            {!isExpired && (
                              <button
                                onClick={() => handleResendInvitation(invitation.id)}
                                className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded transition-colors"
                              >
                                Resend
                              </button>
                            )}
                            <button
                              onClick={() => handleRevokeInvitation(invitation.id)}
                              className="p-2 bg-destructive/10 hover:bg-destructive/20 rounded transition-colors"
                              title="Revoke"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Order Assignment Settings */}
        {canManageMembers && (
          <OrderAssignmentSettings organizationId={currentOrganization.id} />
        )}

        {canEditOrganization && (
          <DashboardAlertThresholdsSettings
            organizationId={currentOrganization.id}
          />
        )}

        {/* Subscription & Billing */}
        {(isOwner || isAdmin) && (
          <SubscriptionSection />
        )}
      </div>

      {showInvitationDialog && currentOrganization && (
        <InvitationDialog
          organizationId={currentOrganization.id}
          organizationName={currentOrganization.name}
          onClose={() => setShowInvitationDialog(false)}
          onInvitationCreated={handleInvitationCreated}
        />
      )}
    </PageLayout>
  );
}

