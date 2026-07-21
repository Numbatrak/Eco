/** Format a number as currency with grouping separators. */
export function formatCurrency(
  value: number | null | undefined,
  currency = "NGN",
  options?: { decimals?: number; fallback?: string }
): string {
  const fallback = options?.fallback ?? "N/A";
  if (value == null || Number.isNaN(value)) return fallback;

  const decimals = options?.decimals ?? 2;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
}

/** Format a number as Nigerian Naira (₦) with grouping separators. */
export function formatNaira(
  value: number | null | undefined,
  options?: { decimals?: number; fallback?: string }
): string {
  return formatCurrency(value, "NGN", options);
}

/** Format a number with commas (no currency symbol) — useful for input hints. */
export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Short product UUID for tables: `fbb3963c…` */
export function formatShortId(id: string | number): string {
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 8)}…`;
}
