/** Numbatrak brand colors for charts and data viz (see brandIdentity.txt) */
export const BRAND_CHART = {
  midnight: "#0F172A",
  deepNavy: "#1E293B",
  emerald: "#10B981",
  softEmerald: "#34D399",
  coolGray: "#94A3B8",
  white: "#FFFFFF",
} as const;

export const BRAND_CHART_SERIES = [
  BRAND_CHART.emerald,
  BRAND_CHART.softEmerald,
  "#64748b",
  "#475569",
] as const;
