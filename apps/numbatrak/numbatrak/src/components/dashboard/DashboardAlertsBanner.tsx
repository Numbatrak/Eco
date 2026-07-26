import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardAlert } from "../../services/dashboardAlerts";

interface DashboardAlertsBannerProps {
  alerts: DashboardAlert[];
}

export function DashboardAlertsBanner({ alerts }: DashboardAlertsBannerProps) {
  if (alerts.length === 0) return null;

  const hasRed = alerts.some((a) => a.severity === "red");

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        hasRed
          ? "border-red-500/40 bg-red-500/10"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`w-5 h-5 shrink-0 mt-0.5 ${
            hasRed ? "text-red-500" : "text-amber-500"
          }`}
        />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {alerts.length} dashboard red-flag{alerts.length !== 1 ? "s" : ""}
          </p>
          <ul className="space-y-1.5">
            {alerts.slice(0, 4).map((alert) => (
              <li key={alert.id} className="text-sm text-muted-foreground">
                <span
                  className={
                    alert.severity === "red"
                      ? "text-red-600 dark:text-red-400 font-medium"
                      : "text-amber-700 dark:text-amber-400 font-medium"
                  }
                >
                  {alert.title}:
                </span>{" "}
                {alert.message}
              </li>
            ))}
          </ul>
          {alerts.length > 4 && (
            <p className="text-xs text-muted-foreground">
              +{alerts.length - 4} more in the notification bell
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
