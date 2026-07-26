import {
  AGENT_EXPENSE_SUBCATEGORIES,
  EXPENSE_CATEGORY_META,
  ExpenseSubcategoryOption,
  ORG_EXPENSE_CATEGORY_IDS,
  OrgExpenseCategory,
} from "../constants/expenseCategories";
import { ExpenseSubcategoryRow } from "../services/expenseSubcategories";

const LEGACY_ORG_CATEGORY_MAP: Record<string, OrgExpenseCategory> = {
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

const LEGACY_SUBCATEGORY_HINTS: Record<string, { category: OrgExpenseCategory; subcategory: string }> = {
  ads: { category: "advertising", subcategory: "other_paid_placement" },
  marketing_materials: { category: "marketing", subcategory: "content_creation" },
  technical: { category: "building", subcategory: "software_development" },
  salary: { category: "operational", subcategory: "salaries_wages" },
  logistics_waybill: { category: "operational", subcategory: "logistics_delivery_fees" },
  pos_charge: { category: "operational", subcategory: "pos_charge" },
  failed_delivery: { category: "operational", subcategory: "failed_delivery" },
};

export function isAdvertisingCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return (
    c === "advertising" ||
    c === "ads" ||
    c.includes("advert") ||
    c.includes("ad spend")
  );
}

export function isOrgExpenseCategory(
  category: string
): category is OrgExpenseCategory {
  return ORG_EXPENSE_CATEGORY_IDS.includes(category as OrgExpenseCategory);
}

export function normalizeOrgExpenseCategory(raw: string): OrgExpenseCategory {
  const key = raw.toLowerCase().trim();
  return LEGACY_ORG_CATEGORY_MAP[key] ?? "operational";
}

export function normalizeExpenseRow(
  category: string,
  subcategory: string,
  scope: "org" | "agent"
): { category: string; subcategory: string } {
  if (scope === "agent") {
    const sub =
      subcategory ||
      (LEGACY_SUBCATEGORY_HINTS[category.toLowerCase()]?.subcategory ??
        category.toLowerCase());
    return { category: "operational", subcategory: sub };
  }

  const normalizedCategory = normalizeOrgExpenseCategory(category);
  const hint = LEGACY_SUBCATEGORY_HINTS[category.toLowerCase()];
  const sub =
    subcategory ||
    hint?.subcategory ||
    EXPENSE_CATEGORY_META[normalizedCategory].subcategories[0]?.id ||
    "other";

  return { category: normalizedCategory, subcategory: sub };
}

export function formatExpenseCategoryLabel(category: string): string {
  if (isOrgExpenseCategory(category)) {
    return EXPENSE_CATEGORY_META[category].label;
  }
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatExpenseSubcategoryLabel(
  category: string,
  subcategory: string
): string {
  const orgCat = isOrgExpenseCategory(category)
    ? category
    : normalizeOrgExpenseCategory(category);
  const fromOrg = EXPENSE_CATEGORY_META[orgCat]?.subcategories.find(
    (s) => s.id === subcategory
  );
  if (fromOrg) return fromOrg.label;
  const fromAgent = AGENT_EXPENSE_SUBCATEGORIES.find((s) => s.id === subcategory);
  if (fromAgent) return fromAgent.label;
  return subcategory
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function subcategoriesForCategory(
  category: OrgExpenseCategory,
  scope: "org" | "agent",
  custom: ExpenseSubcategoryRow[] = []
): ExpenseSubcategoryOption[] {
  if (scope === "agent") return AGENT_EXPENSE_SUBCATEGORIES;
  const builtIn = EXPENSE_CATEGORY_META[category].subcategories;
  const customForCat = custom
    .filter((c) => c.parent_category === category)
    .map((c) => ({ id: c.slug, label: c.label }));
  const seen = new Set(builtIn.map((s) => s.id));
  const merged = [...builtIn];
  for (const c of customForCat) {
    if (!seen.has(c.id)) merged.push(c);
  }
  return merged;
}
