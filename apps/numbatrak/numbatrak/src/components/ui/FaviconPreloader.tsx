import { useId } from "react";
import "./loaders.css";

/** Bars match public/favicon.svg — grow bottom-to-top in sequence. */
const FAVICON_BARS = [
  { x: 5.76, y: 18.848, w: 3.562, h: 7.392 },
  { x: 11.993, y: 14.228, w: 3.562, h: 12.012 },
  { x: 18.226, y: 17, w: 3.562, h: 9.24 },
  { x: 24.459, y: 7.76, w: 3.562, h: 18.48 },
] as const;

const STAGGER_S = 0.14;

interface FaviconPreloaderProps {
  size?: number;
  className?: string;
}

/** Full-screen boot loader — favicon mark only, no caption. */
export function FaviconPreloader({ size = 72, className = "" }: FaviconPreloaderProps) {
  const gradId = useId().replace(/:/g, "");

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="favicon-preloader-mark"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={32} height={32} rx={3.072} fill={`url(#${gradId})`} />
        {FAVICON_BARS.map((bar, i) => (
          <rect
            key={i}
            className="favicon-preloader-bar"
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx={2}
            fill="#FFFFFF"
            style={{ animationDelay: `${i * STAGGER_S}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
