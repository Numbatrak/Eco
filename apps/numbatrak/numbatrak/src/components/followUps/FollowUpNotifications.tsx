import { useEffect, useState } from "react";
import { FollowUpWithRelations } from "../../types/followUp";
import { useAuth } from "../../auth/AuthProvider";
import { useOrganization } from "../../contexts/OrganizationContext";
import { fetchFollowUps } from "../../services/followUps";
import { Bell, X, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { formatWorkHours, meetsSLA } from "../../utils/workHours";
import { activeStatusFilterValues } from "../../utils/followUpStatus";

interface Notification {
  id: string;
  type: "new_assignment" | "sla_warning" | "sla_overdue" | "completed";
  followUp: FollowUpWithRelations;
  message: string;
  timestamp: Date;
}

/**
 * The source app also used a Supabase Realtime channel (postgres_changes on
 * follow_ups) for instant "new assignment"/"completed" toasts, on top of
 * this 60s poll for SLA warnings. There's no equivalent against the new
 * backend, so the Realtime half is dropped - only the poll-derived
 * sla_warning/sla_overdue notification types fire now; new_assignment and
 * completed toasts no longer appear. Flagged as an accepted downgrade, not
 * silently dropped - reinstating "new assignment" toasts would need either
 * polling-with-diffing against previously-seen follow-up ids, or a
 * WebSocket/SSE push channel on the backend.
 */
export function FollowUpNotifications() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user || !currentOrganization) return;

    checkForNotifications();
    const interval = setInterval(() => {
      checkForNotifications();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentOrganization?.id]);

  const checkForNotifications = async () => {
    if (!user || !currentOrganization) return;

    try {
      const followUps = await fetchFollowUps(currentOrganization.id, 0, 200, "desc", {
        assigned_to: user.id,
      });
      const active = followUps.filter((fu) => activeStatusFilterValues().includes(fu.status));

      const now = new Date();
      const newNotifications: Notification[] = [];

      active.forEach((fu) => {
        if (fu.first_contact_at) {
          const responseTime = fu.response_time_minutes;
          if (responseTime !== null) {
            if (!meetsSLA(responseTime)) {
              newNotifications.push({
                id: `overdue-${fu.id}`,
                type: "sla_overdue",
                followUp: fu,
                message: `Follow-up overdue: ${fu.order_id ? `Order #${fu.order_id}` : `Cart #${fu.abandoned_cart_id}`} - Response time: ${formatWorkHours(responseTime)}`,
                timestamp: now,
              });
            } else if (responseTime >= 50) {
              newNotifications.push({
                id: `warning-${fu.id}`,
                type: "sla_warning",
                followUp: fu,
                message: `Follow-up approaching SLA: ${fu.order_id ? `Order #${fu.order_id}` : `Cart #${fu.abandoned_cart_id}`} - ${formatWorkHours(responseTime)}`,
                timestamp: now,
              });
            }
          }
        } else if (fu.created_at) {
          const created = new Date(fu.created_at);
          const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
          if (diffMinutes >= 50) {
            newNotifications.push({
              id: `warning-${fu.id}`,
              type: "sla_warning",
              followUp: fu,
              message: `Follow-up needs attention: ${fu.order_id ? `Order #${fu.order_id}` : `Cart #${fu.abandoned_cart_id}`}`,
              timestamp: now,
            });
          }
        }
      });

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const toAdd = newNotifications.filter((n) => !existingIds.has(n.id));
        return [...prev, ...toAdd].slice(-10);
      });
    } catch (err) {
      console.error("Error checking notifications:", err);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "new_assignment":
        return <Bell className="w-5 h-5 text-primary" />;
      case "sla_warning":
        return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "sla_overdue":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
    }
  };

  const getNotificationPanelClass = (type: Notification["type"]) => {
    switch (type) {
      case "new_assignment":
        return "border-l-primary bg-primary/5";
      case "sla_warning":
        return "border-l-amber-500 bg-amber-500/10";
      case "sla_overdue":
        return "border-l-destructive bg-destructive/10";
      case "completed":
        return "border-l-primary bg-primary/10";
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all"
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute bottom-16 right-0 w-80 bg-card text-card-foreground rounded-lg shadow-xl border border-border max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-l-4 ${getNotificationPanelClass(notification.type)}`}
              >
                <div className="flex items-start gap-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {notifications.length > 0 && (
            <div className="p-2 border-t border-border">
              <button
                onClick={() => setNotifications([])}
                className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
