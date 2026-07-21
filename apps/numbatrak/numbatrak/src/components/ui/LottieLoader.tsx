import { useId } from "react";
import "./loaders.css";

interface LottieLoaderProps {
  size?: number;
  message?: string;
  className?: string;
}

/** Open-arc spinner with sharp caps — used across section/table loaders. */
export function LottieLoader({ size = 120, message, className = "" }: LottieLoaderProps) {
  const gradId = useId().replace(/:/g, "");
  const strokeWidth = Math.max(3, size * 0.075);
  const radius = (size - strokeWidth) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.68;
  const gapLength = circumference - arcLength;

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? "Loading"}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="arc-loader-spin"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground/15"
          strokeWidth={strokeWidth * 0.55}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={gapLength * 0.15}
        />
      </svg>
      {message && (
        <p className="mt-3 text-sm font-medium text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
