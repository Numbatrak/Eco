import { FollowUpWithRelations } from "../../types/followUp";
import {
  FOLLOW_UP_STATUS_LABELS,
  normalizeFollowUpStatus,
} from "../../utils/followUpStatus";
import { Pencil, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { formatWorkHours, meetsSLA } from "../../utils/workHours";
import "./FollowUpTable.css";

interface FollowUpTableRowProps {
  followUp: FollowUpWithRelations;
  index: number;
  onEdit: (followUp: FollowUpWithRelations) => void;
  onDelete: (followUpId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function FollowUpTableRow({
  followUp,
  index,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: FollowUpTableRowProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalized = normalizeFollowUpStatus(status);
    const label = FOLLOW_UP_STATUS_LABELS[normalized];
    const badgeClass =
      normalized === "awaiting"
        ? "pending"
        : normalized === "followed_up"
          ? "in-progress"
          : normalized === "resolved"
            ? "completed"
            : normalized;

    const Icon =
      normalized === "awaiting"
        ? Clock
        : normalized === "followed_up"
          ? AlertCircle
          : normalized === "resolved"
            ? CheckCircle2
            : XCircle;

    return (
      <span className={`follow-up-table-status-badge ${badgeClass}`}>
        <Icon className="follow-up-table-status-icon" />
        {label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityLower = priority.toLowerCase();
    const classes = {
      low: "follow-up-table-priority-badge low",
      medium: "follow-up-table-priority-badge medium",
      high: "follow-up-table-priority-badge high",
      urgent: "follow-up-table-priority-badge urgent",
    };
    return (
      <span className={classes[priorityLower as keyof typeof classes] || classes.medium}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const responseTime = followUp.response_time_minutes;
  const resolutionTime = followUp.resolution_time_minutes;
  const slaMet = responseTime !== null ? meetsSLA(responseTime) : null;

  return (
    <tr>
      <td className="follow-up-table-cell">
        {followUp.order_id ? (
          <span className="follow-up-table-reference">
            Order #{followUp.order_id}
          </span>
        ) : followUp.abandoned_cart_id ? (
          <span className="follow-up-table-reference">
            Cart #{followUp.abandoned_cart_id}
          </span>
        ) : (
          <span className="follow-up-table-empty-value">N/A</span>
        )}
      </td>
      <td className="follow-up-table-cell">
        {followUp.order_id ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {followUp.order_customer_name || "N/A"}
            </p>
            {followUp.order_customer_phone && (
              <p className="text-xs text-muted-foreground">{followUp.order_customer_phone}</p>
            )}
          </div>
        ) : followUp.abandoned_cart_id ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {followUp.cart_customer_name || "N/A"}
            </p>
            {(followUp.cart_customer_phone || followUp.cart_customer_whatsapp) && (
              <p className="text-xs text-muted-foreground">
                {followUp.cart_customer_phone || followUp.cart_customer_whatsapp}
              </p>
            )}
          </div>
        ) : (
          <span className="follow-up-table-empty-value">N/A</span>
        )}
      </td>
      <td className="follow-up-table-cell">
        {followUp.assigned_user_name || followUp.assigned_user_email ? (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {followUp.assigned_user_name || "Unnamed CSR"}
            </p>
            {followUp.assigned_user_email && (
              <p className="text-xs text-muted-foreground">
                {followUp.assigned_user_email}
              </p>
            )}
          </div>
        ) : (
          <span className="follow-up-table-empty-value">Unassigned</span>
        )}
      </td>
      <td className="follow-up-table-cell">{getStatusBadge(followUp.status)}</td>
      <td className="follow-up-table-cell">{getPriorityBadge(followUp.priority)}</td>
      <td className="follow-up-table-cell text-center">
        {responseTime !== null ? (
          <div className="flex items-center justify-center gap-1">
            <span className="follow-up-table-time">
              {formatWorkHours(responseTime)}
            </span>
            {slaMet !== null && (
              <span
                className={`follow-up-table-sla-badge ${
                  slaMet ? "met" : "missed"
                }`}
                title={slaMet ? "SLA Met (≤1 hour)" : "SLA Missed (>1 hour)"}
              >
                {slaMet ? "✓" : "✗"}
              </span>
            )}
          </div>
        ) : (
          <span className="follow-up-table-empty-value">N/A</span>
        )}
      </td>
      <td className="follow-up-table-cell text-center">
        {resolutionTime !== null ? (
          <span className="follow-up-table-time">
            {formatWorkHours(resolutionTime)}
          </span>
        ) : (
          <span className="follow-up-table-empty-value">N/A</span>
        )}
      </td>
      <td className="follow-up-table-cell">
        {followUp.outcome ? (
          <span className="follow-up-table-outcome">
            {followUp.outcome.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
        ) : (
          <span className="follow-up-table-empty-value">N/A</span>
        )}
      </td>
      <td className="follow-up-table-cell">{formatDate(followUp.created_at)}</td>
      <td className="follow-up-table-cell text-right">
        <div className="follow-up-table-actions">
          {canEdit && (
            <button
              onClick={() => onEdit(followUp)}
              className="follow-up-table-action-button edit"
              title="Edit follow-up"
            >
              <Pencil className="follow-up-table-action-icon" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(followUp.id)}
              className="follow-up-table-action-button delete"
              title="Delete follow-up"
            >
              <Trash2 className="follow-up-table-action-icon" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

