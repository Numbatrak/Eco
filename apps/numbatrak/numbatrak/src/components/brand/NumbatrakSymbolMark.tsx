import { useId } from "react";

/** Five ascending bars per brand spec — tallest is the fourth bar. */
export function NumbatrakSymbolMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradId = `nt-sym-${useId().replace(/:/g, "")}`;
  const h = size;
  const w = size;
  const rx = Math.max(2, size * 0.08);
  const pad = size * 0.18;
  const innerW = w - pad * 2;
  const barW = (innerW * 4) / 23;
  const gap = (innerW * 3) / 23;
  const maxBar = h - pad * 2 - 2;
  const heights = [
    maxBar * 0.4,
    maxBar * 0.65,
    maxBar * 0.5,
    maxBar * 1.0,
    maxBar * 0.8,
  ];
  const baseY = h - pad;
  let x = pad;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={rx * 1.2}
        fill={`url(#${gradId})`}
      />
      {heights.map((bh, i) => {
        const rect = (
          <rect
            key={i}
            x={x}
            y={baseY - bh}
            width={barW}
            height={bh}
            rx={2 * (size / 32)}
            fill="#FFFFFF"
          />
        );
        x += barW + gap;
        return rect;
      })}
    </svg>
  );
}
