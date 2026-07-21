import { useState, useEffect } from "react";
import {
  MessageSquare,
  AlertTriangle,
  Award,
  Clock,
  CheckCircle,
} from "lucide-react";
import { LoadingState } from "./ui/LoadingState";
import { useOrganization } from "../contexts/OrganizationContext";
import { usePermissions } from "../hooks/usePermissions";
import {
  fetchActivities,
  formatRelativeTime,
  getActivityIconType,
} from "../services/activities";
import { ActivityWithUser } from "../types/activity";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type IconType = "reminder" | "breach" | "award" | "alert" | "success";

const iconMap: Record<IconType, { Icon: React.ElementType; classes: string }> = {
  reminder: {
    Icon: MessageSquare,
    classes: "bg-muted text-muted-foreground",
  },
  breach: {
    Icon: AlertTriangle,
    classes: "bg-destructive/10 text-destructive",
  },
  award: {
    Icon: Award,
    classes: "bg-primary/10 text-primary",
  },
  alert: {
    Icon: Clock,
    classes: "bg-muted text-muted-foreground",
  },
  success: {
    Icon: CheckCircle,
    classes: "bg-primary/10 text-primary",
  },
};

export function ActivityFeed() {
  const { currentOrganization } = useOrganization();
  const { hasAnyRole } = usePermissions();
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewActivities = hasAnyRole(["Owner", "Admin"]);

  useEffect(() => {
    if (!canViewActivities || !currentOrganization) {
      setLoading(false);
      return;
    }

    const loadActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchActivities(currentOrganization.id, 50);
        setActivities(data);
      } catch (err: any) {
        console.error("Error loading activities:", err);
        setError(err.message || "Failed to load activities");
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [currentOrganization, canViewActivities]);

  if (!canViewActivities) return null;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {loading ? (
          <LoadingState label="Loading activity…" size="sm" />
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activities yet. Activities will appear here as users perform
            actions.
          </p>
        ) : (
          <div className="flex flex-col gap-1 max-h-96 overflow-y-auto -mx-1 px-1">
            {activities.map((activity) => {
              const iconType = getActivityIconType(activity.action_type);
              const { Icon, classes } = iconMap[iconType] ?? iconMap.reminder;
              const userName =
                activity.user?.full_name ||
                activity.user?.email ||
                activity.user_name ||
                "Unknown User";

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${classes}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        •
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {userName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
