import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import { fetchMyPendingInvitations } from "../../services/organizationInvitations";
import { OrganizationInvitation } from "../../types/organization";
import { Mail, X } from "lucide-react";

export function InvitationNotification() {
  const { isAuthenticated, user } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const dismissedFlag = localStorage.getItem("invitationNotificationDismissed");
      if (!dismissedFlag) {
        loadPendingInvitations();
      }
    }
  }, [isAuthenticated, user]);

  const loadPendingInvitations = async () => {
    try {
      setLoading(true);
      const invitations = await fetchMyPendingInvitations();
      setPendingInvitations(invitations);
    } catch (err: unknown) {
      console.error("Error loading pending invitations:", err);
    } finally {
      setLoading(false);
    }
  };

  if (
    !isAuthenticated ||
    dismissed ||
    loading ||
    pendingInvitations.length === 0 ||
    location.pathname === "/accept-invitation"
  ) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("invitationNotificationDismissed", "true");
  };

  const handleViewInvitations = () => {
    navigate("/accept-invitation");
  };

  return (
    <div className="page-toast" role="status">
      <div className="page-toast-panel info">
        <div className="page-toast-icon info">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <div className="page-toast-body">
          <h3 className="page-toast-title">
            You have {pendingInvitations.length} pending invitation
            {pendingInvitations.length > 1 ? "s" : ""}
          </h3>
          <p className="page-toast-subtitle">
            {pendingInvitations.length === 1
              ? `You've been invited to join ${pendingInvitations[0].organization?.name || "an organization"}`
              : "You've been invited to join multiple organizations"}
          </p>
          <div className="page-toast-actions">
            <button
              type="button"
              onClick={handleViewInvitations}
              className="page-toast-action-btn primary"
            >
              View Invitations
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="page-toast-dismiss"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
