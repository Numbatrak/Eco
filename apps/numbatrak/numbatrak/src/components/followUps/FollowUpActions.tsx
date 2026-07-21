import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Clock, CheckCircle2, XCircle } from "lucide-react";
import { FollowUpWithRelations, FollowUpOutcome } from "../../types/followUp";
import { fetchFollowUps, updateFollowUp, createFollowUp } from "../../services/followUps";
import { formatWorkHours, meetsSLA } from "../../utils/workHours";
import {
  FOLLOW_UP_STATUS_LABELS,
  isActiveFollowUpStatus,
  isResolvedFollowUpStatus,
} from "../../utils/followUpStatus";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import { useOrganization } from "../../contexts/OrganizationContext";
import "./FollowUpActions.css";

interface FollowUpActionsProps {
  orderId?: string;
  abandonedCartId?: string | number;
  onFollowUpCreated?: () => void;
  onFollowUpUpdated?: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  compact?: boolean;
}

function normalizeCartId(id?: string | number): string | undefined {
  if (id === undefined || id === null || id === "") return undefined;
  return String(id);
}

export function FollowUpActions({
  orderId,
  abandonedCartId,
  onFollowUpCreated,
  onFollowUpUpdated,
  onSuccess,
  onError,
  compact = true,
}: FollowUpActionsProps) {
  const { user } = useSupabaseAuth();
  const { currentOrganization } = useOrganization();
  const cartId = normalizeCartId(abandonedCartId);
  const [followUps, setFollowUps] = useState<FollowUpWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadFollowUps = useCallback(async () => {
    const orgId = currentOrganization?.id ?? null;
    if (!orgId) {
      setFollowUps([]);
      return;
    }

    if (!orderId && !cartId) {
      setFollowUps([]);
      return;
    }

    try {
      setLoading(true);
      let data: FollowUpWithRelations[] = [];

      if (orderId) {
        data = await fetchFollowUps(orgId, 0, 100, "desc", { order_id: orderId });
      } else if (cartId) {
        data = await fetchFollowUps(orgId, 0, 100, "desc", {
          abandoned_cart_id: cartId,
        });
      }

      setFollowUps(data);
    } catch (err) {
      console.error("Error loading follow-ups:", err);
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, cartId, currentOrganization?.id]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  const handleCreateFollowUp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !currentOrganization) {
      onError?.("Sign in and select an organization to create a follow-up.");
      return;
    }

    try {
      setActionLoading(true);

      await createFollowUp({
        organization_id: currentOrganization.id,
        order_id: orderId || null,
        abandoned_cart_id: cartId || null,
        priority: "medium",
      });

      await loadFollowUps();
      onFollowUpCreated?.();
      onSuccess?.("Follow-up created successfully.");
    } catch (err) {
      console.error("Error creating follow-up:", err);
      const message =
        err instanceof Error ? err.message : "Failed to create follow-up.";
      onError?.(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowedUp = async (e: React.MouseEvent, followUpId: number) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      await updateFollowUp(followUpId, {
        status: "followed_up",
        first_contact_at: new Date().toISOString(),
      });
      onSuccess?.("Marked as followed up.");
      await loadFollowUps();
      onFollowUpUpdated?.();
    } catch (err) {
      console.error("Error updating follow-up:", err);
      onError?.("Failed to update follow-up.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (
    e: React.MouseEvent,
    followUpId: number,
    outcome: FollowUpOutcome
  ) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      await updateFollowUp(followUpId, {
        status: "resolved",
        completed_at: new Date().toISOString(),
        outcome,
      });
      onSuccess?.(
        outcome === "converted"
          ? "Follow-up resolved — converted."
          : "Follow-up resolved — not converted."
      );
      await loadFollowUps();
      onFollowUpUpdated?.();
    } catch (err) {
      console.error("Error resolving follow-up:", err);
      onError?.("Failed to resolve follow-up.");
    } finally {
      setActionLoading(false);
    }
  };

  const activeFollowUp = followUps.find((fu) => isActiveFollowUpStatus(fu.status));

  const isBusy = loading || actionLoading;

  if (followUps.length === 0) {
    return (
      <button
        type="button"
        onClick={handleCreateFollowUp}
        disabled={isBusy}
        className="follow-up-create-btn"
        title="Create follow-up"
      >
        <MessageSquare className="follow-up-create-btn-icon" />
        {!compact && <span>Create Follow-Up</span>}
        {compact && <span className="follow-up-create-btn-label">Follow-up</span>}
      </button>
    );
  }

  return (
    <div className="follow-up-actions" onClick={(e) => e.stopPropagation()}>
      {activeFollowUp && (
        <>
          <div className="follow-up-status">
            <span
              className={`follow-up-status-dot ${
                activeFollowUp.status === "awaiting" ? "pending" : "in-progress"
              }`}
            />
            <span className="follow-up-status-label">
              {FOLLOW_UP_STATUS_LABELS[activeFollowUp.status]}
            </span>
            {activeFollowUp.response_time_minutes !== null && (
              <span
                className={`follow-up-sla-badge ${
                  meetsSLA(activeFollowUp.response_time_minutes) ? "ok" : "late"
                }`}
                title={`Response time: ${formatWorkHours(activeFollowUp.response_time_minutes)}`}
              >
                {formatWorkHours(activeFollowUp.response_time_minutes)}
              </span>
            )}
          </div>

          {activeFollowUp.status === "awaiting" && (
            <button
              type="button"
              onClick={(e) => handleFollowedUp(e, activeFollowUp.id)}
              disabled={isBusy}
              className="follow-up-action-btn"
              title="Record first contact"
            >
              <Clock className="h-3 w-3" />
              Contact
            </button>
          )}

          {(activeFollowUp.status === "awaiting" ||
            activeFollowUp.status === "followed_up") && (
            <>
              <button
                type="button"
                onClick={(e) =>
                  handleResolve(e, activeFollowUp.id, "converted")
                }
                disabled={isBusy}
                className="follow-up-action-btn primary"
                title="Resolved — converted"
              >
                <CheckCircle2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) =>
                  handleResolve(e, activeFollowUp.id, "not_converted")
                }
                disabled={isBusy}
                className="follow-up-action-btn"
                title="Resolved — not converted"
              >
                <XCircle className="h-3 w-3" />
              </button>
            </>
          )}
        </>
      )}

      {followUps.filter((fu) => isResolvedFollowUpStatus(fu.status)).length > 0 && (
        <span className="follow-up-completed-count">
          {followUps.filter((fu) => isResolvedFollowUpStatus(fu.status)).length}{" "}
          resolved
        </span>
      )}
    </div>
  );
}
