/** Section 06 — four org-level expense categories (Developer Brief). */
export type OrgExpenseCategory =
  | "operational"
  | "building"
  | "marketing"
  | "advertising";

export const ORG_EXPENSE_CATEGORY_IDS: OrgExpenseCategory[] = [
  "operational",
  "building",
  "marketing",
  "advertising",
];

export interface ExpenseSubcategoryOption {
  id: string;
  label: string;
}

export interface ExpenseCategoryMeta {
  id: OrgExpenseCategory;
  label: string;
  description: string;
  subcategories: ExpenseSubcategoryOption[];
}

/** Per-agent costs roll up under operational (POS, failed delivery, etc.). */
export const AGENT_EXPENSE_SUBCATEGORIES: ExpenseSubcategoryOption[] = [
  { id: "pos_charge", label: "POS charge" },
  { id: "failed_delivery", label: "Failed delivery cost" },
  { id: "logistics_delivery_fees", label: "Logistics / delivery" },
  { id: "agent_remittance_net_off", label: "Agent remittance net-off" },
  { id: "other", label: "Other" },
];

export const EXPENSE_CATEGORY_META: Record<
  OrgExpenseCategory,
  ExpenseCategoryMeta
> = {
  operational: {
    id: "operational",
    label: "Operational",
    description:
      "Daily recurring costs: logistics, salaries, packaging, platform fees.",
    subcategories: [
      { id: "logistics_delivery_fees", label: "Logistics & delivery fees" },
      { id: "automation_software", label: "Automation & software subscriptions" },
      { id: "office_supplies_utilities", label: "Office supplies & utilities" },
      { id: "internet_communication", label: "Internet & communication" },
      { id: "salaries_wages", label: "Salaries & staff wages" },
      { id: "customer_service", label: "Customer service costs" },
      { id: "packaging_materials", label: "Packaging materials" },
      { id: "platform_transaction_fees", label: "Platform & transaction fees" },
      { id: "other", label: "Other operational" },
    ],
  },
  building: {
    id: "building",
    label: "Building",
    description:
      "One-off or infrequent spend that builds assets: equipment, legal, brand.",
    subcategories: [
      { id: "software_development", label: "Software development & infrastructure" },
      { id: "equipment_hardware", label: "Equipment & hardware" },
      { id: "website_domain_hosting", label: "Website, domain & hosting" },
      { id: "brand_design", label: "Brand & design work" },
      { id: "training_development", label: "Training & staff development" },
      { id: "legal_registration", label: "Legal & registration fees" },
      { id: "photography_content_production", label: "Photography & content production" },
      { id: "other", label: "Other building" },
    ],
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    description:
      "Marketing that is not direct ad spend: awareness, content, influencers.",
    subcategories: [
      { id: "content_creation", label: "Content creation costs" },
      { id: "influencer_creator_fees", label: "Influencer & creator fees" },
      { id: "email_sms_platform", label: "Email & SMS platform costs" },
      { id: "organic_social_production", label: "Organic social media production" },
      { id: "pr_press", label: "PR & press costs" },
      { id: "sponsorships_partnerships", label: "Sponsorships & partnerships" },
      { id: "other", label: "Other marketing" },
    ],
  },
  advertising: {
    id: "advertising",
    label: "Advertising",
    description:
      "Pure paid ad spend, tracked separately for advertising ROAS.",
    subcategories: [
      { id: "meta_ads", label: "Meta ads (Facebook & Instagram)" },
      { id: "google_ads", label: "Google Ads" },
      { id: "tiktok_ads", label: "TikTok Ads" },
      { id: "other_paid_placement", label: "Other paid placement" },
    ],
  },
};
