import { LottieLoader } from "./LottieLoader";

interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const LOADER_SIZES = { sm: 64, md: 80, lg: 100 } as const;

/** Centered section/page loader with the brand arc spinner. */
export function LoadingState({
  label = "Loading…",
  className = "",
  size = "md",
}: LoadingStateProps) {
  return (
    <LottieLoader
      size={LOADER_SIZES[size]}
      message={label}
      className={`py-10 ${className}`.trim()}
    />
  );
}

interface TableLoadingCellProps {
  colSpan: number;
  message?: string;
  size?: number;
  className?: string;
}

/** Table row loader — use inside `<tr>` for data tables. */
export function TableLoadingCell({
  colSpan,
  message = "Loading…",
  size = 72,
  className = "",
}: TableLoadingCellProps) {
  return (
    <td colSpan={colSpan} className={`px-6 py-12 text-center ${className}`.trim()}>
      <LottieLoader size={size} message={message} />
    </td>
  );
}

interface CardListSkeletonProps {
  rows?: number;
}

export function CardListSkeleton({ rows = 5 }: CardListSkeletonProps) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-lg bg-muted animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="flex flex-col gap-2 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }).map((_, col) => (
            <div
              key={col}
              className="h-10 flex-1 rounded-lg bg-muted animate-pulse"
              style={{ animationDelay: `${(row + col) * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
