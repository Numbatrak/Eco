import { LucideIcon } from "lucide-react";
import type { HealthBand } from "../utils/dashboardHealth";
import { healthBorderClass } from "../utils/dashboardHealth";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  valueClassName?: string;
  healthBand?: HealthBand | null;
  onExplain?: () => void;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "indigo" | "green" | "red" | "amber" | "blue" | "purple" | "teal";
}

const colorMap: Record<
  NonNullable<KPICardProps["color"]>,
  { iconBg: string; iconText: string }
> = {
  indigo: {
    iconBg: "bg-primary/10 dark:bg-primary/20",
    iconText: "text-primary dark:text-primary/90",
  },
  blue: {
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-500 dark:text-blue-400",
  },
  green: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconText: "text-emerald-500 dark:text-emerald-400",
  },
  teal: {
    iconBg: "bg-teal-500/10 dark:bg-teal-400/10",
    iconText: "text-teal-500 dark:text-teal-400",
  },
  red: {
    iconBg: "bg-red-500/10 dark:bg-red-400/10",
    iconText: "text-red-500 dark:text-red-400",
  },
  amber: {
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconText: "text-amber-500 dark:text-amber-400",
  },
  purple: {
    iconBg: "bg-purple-500/10 dark:bg-purple-400/10",
    iconText: "text-purple-500 dark:text-purple-400",
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  subtitle,
  valueClassName,
  healthBand,
  onExplain,
  trend,
  color = "indigo",
}: KPICardProps) {
  const { iconBg, iconText } = colorMap[color] ?? colorMap.indigo;
  const borderClass = healthBand ? healthBorderClass(healthBand) : "border-border";
  const interactive = Boolean(onExplain);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onExplain}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExplain?.();
              }
            }
          : undefined
      }
      className={`bg-card border rounded-xl p-5 flex items-start justify-between gap-4 transition-shadow hover:shadow-md ${borderClass} ${
        interactive ? "cursor-pointer hover:border-primary/40" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground mb-2 truncate">{title}</p>
        <p
          className={`font-metric text-2xl font-semibold leading-none text-foreground mb-1 ${valueClassName ?? ""}`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
        {onExplain && (
          <p className="text-[10px] text-primary/80 mt-1">Tap for explainer</p>
        )}
        {trend && (
          <div
            className={`inline-flex items-center gap-1 text-xs mt-1 font-medium ${
              trend.isPositive ? "text-emerald-500" : "text-red-500"
            }`}
          >
            <span>{trend.isPositive ? "↑" : "↓"}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg ${iconBg} ${iconText} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
