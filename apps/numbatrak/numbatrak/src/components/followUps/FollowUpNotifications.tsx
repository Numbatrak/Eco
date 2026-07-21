import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { FollowUpWithRelations } from "../../types/followUp";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import { Bell, X, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { formatWorkHours, meetsSLA } from "../../utils/workHours";
import {
  activeStatusFilterValues,
  normalizeFollowUpStatus,
} from "../../utils/followUpStatus";

interface Notification {
  id: string;
  type: "new_assignment" | "sla_warning" | "sla_overdue" | "completed";
  followUp: FollowUpWithRelations;
  message: string;
  timestamp: Date;
}

export function FollowUpNotifications() {
  const { user } = useSupabaseAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("follow-ups-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follow_ups",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          handleFollowUpChange(payload);
        }
      )
      .subscribe();

    checkForNotifications();

    const interval = setInterval(() => {
      checkForNotifications();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  const handleFollowUpChange = async (payload: any) => {
    if (payload.eventType === "INSERT") {
      const followUp = payload.new as FollowUpWithRelations;
      addNotification({
        id: `new-${followUp.id}`,
        type: "new_assignment",
        followUp,
        message: `New follow-up assigned: ${followUp.order_id ? `Order #${followUp.order_id}` : `Cart #${followUp.abandoned_cart_id}`}`,
        timestamp: new Date(),
      });
    } else if (payload.eventType === "UPDATE") {
      const followUp = payload.new as FollowUpWithRelations;
      if (normalizeFollowUpStatus(followUp.status) === "resolved") {
        addNotification({
          id: `completed-${followUp.id}`,
          type: "completed",
          followUp,
          message: `Follow-up completed: ${followUp.order_id ? `Order #${followUp.order_id}` : `Cart #${followUp.abandoned_cart_id}`}`,
          timestamp: new Date(),
        });
      }
    }
  };

  const checkForNotifications = async () => {
    if (!user) return;

    try {
      const { data: followUps, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("assigned_to", user.id)
        .in("status", activeStatusFilterValues());

      if (error) {
        console.error("Error checking notifications:", error);
        return;
      }

      const now = new Date();
      const newNotifications: Notification[] = [];

      followUps?.forEach((fu: any) => {
        if (fu.first_contact_at) {
          const responseTime = fu.response_time_minutes;
          if (responseTime !== null) {
            if (!meetsSLA(responseTime)) {
              newNotifications.push({
                id: `overdue-${fu.id}`,
                type: "sla_overdue",
                followUp: fu as FollowUpWithRelations,
                message: `Follow-up overdue: ${fu.order_id ? `Order #${fu.order_id}` : `Cart #${fu.abandoned_cart_id}`} - Response time: ${formatWorkHours(responseTime)}`,
                timestamp: now,
              });
            } else if (responseTime >= 50) {
              newNotifications.push({
                id: `warning-${fu.id}`,
                type: "sla_warning",
                followUp: fu as FollowUpWithRelations,
                message: `Follow-up approaching SLA: ${fu.order_id ? `Order #${fu.order_id}` : `Cart #${fu.abandoned_cart_id}`} - ${formatWorkHours(responseTime)}`,
                timestamp: now,
              });
            }
          }
        } else {
          const created = new Date(fu.created_at);
          const diffMinutes = Math.floor(
            (now.getTime() - created.getTime()) / (1000 * 60)
          );
          if (diffMinutes >= 50) {
            newNotifications.push({
              id: `warning-${fu.id}`,
              type: "sla_warning",
              followUp: fu as FollowUpWithRelations,
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

  const addNotification = (notification: Notification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev].slice(0, 10);
    });
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
