// Server-side port of the category-bucketing subset of
// src/utils/expenseCategoryHelpers.ts, needed for GET /expenses/summary's
// server-side aggregation. Only the legacy->canonical org-category mapping
// is ported (not the fuller subcategory-label logic, which stays a
// display-only frontend concern) - determines which of the four category
// buckets a row's amount lands in, which affects reported totals for any
// legacy/migrated free-text category values.
const LEGACY_ORG_CATEGORY_MAP: Record<string, "operational" | "building" | "marketing" | "advertising"> = {
  ads: "advertising",
  advertising: "advertising",
  marketing_materials: "marketing",
  marketing: "marketing",
  technical: "building",
  building: "building",
  salary: "operational",
  logistics_waybill: "operational",
  logistics: "operational",
  other: "operational",
  operational: "operational",
};

export function normalizeOrgExpenseCategory(raw: string): "operational" | "building" | "marketing" | "advertising" {
  const key = raw.toLowerCase().trim();
  return LEGACY_ORG_CATEGORY_MAP[key] ?? "operational";
}

export function isAdvertisingCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return c === "advertising" || c === "ads" || c.includes("advert") || c.includes("ad spend");
}
