import { OrgExpenseCategory } from "../constants/expenseCategories";

export type ExpenseSourceType =
  | "manual"
  | "waybill_fee"
  | "failed_delivery"
  | "wallet_net_off";

export const AD_PLATFORM_BY_SUBCATEGORY: Record<string, string> = {
  meta_ads: "Meta",
  google_ads: "Google",
  tiktok_ads: "TikTok",
  other_paid_placement: "Other",
};

export function platformForAdvertisingSubcategory(subcategory: string): string | null {
  return AD_PLATFORM_BY_SUBCATEGORY[subcategory] ?? null;
}

export function validateExpenseAttribution(input: {
  scope: "org" | "agent";
  category: string;
  subcategory?: string;
  product_id?: string | null;
  offer_name?: string | null;
}): string | null {
  if (input.scope !== "org") return null;

  const cat = input.category as OrgExpenseCategory;

  if (cat === "advertising") {
    if (!input.product_id) {
      return "Advertising expenses require a product.";
    }
    if (!input.offer_name?.trim()) {
      return "Advertising expenses require an offer name.";
    }
  }

  return null;
}

export function isAutoFedExpense(sourceType?: string | null): boolean {
  return !!sourceType && sourceType !== "manual";
}
