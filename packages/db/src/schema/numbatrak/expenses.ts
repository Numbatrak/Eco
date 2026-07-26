// Numbatrak domain: expense tracking. `unified_expenses` is the current-path
// hub (Operational/Building/Marketing/Advertising + agent-cost tabs);
// `numbatrakAgentExpensesLegacy` (source `public.agent_expenses`) is its
// predecessor and is nominally superseded (unified_expenses carries a
// `legacy_agent_expense_id` provenance/dedup column pointing back to it), but
// src/services/expenses.ts still actively reads and writes it today - migrated
// as-is, not dropped, matching the same "still-live legacy" treatment as the
// inventory totals table (see inventory.ts).
import { sql } from "drizzle-orm";
import { bigint, check, date, index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakAgents } from "./agents.js";
import { numbatrakCustomerOrders } from "./orders.js";
import { numbatrakProducts } from "./products.js";

export const numbatrakUnifiedExpenses = pgTable(
  "numbatrak_unified_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    // Source CHECK is conditional on `scope`: org rows must use one of the
    // four parent categories; agent rows must be 'operational'. Both
    // constraints preserved below.
    category: text("category").notNull(),
    subcategory: text("subcategory").default(""),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    agentId: bigint("agent_id", { mode: "number" }).references(() => numbatrakAgents.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => numbatrakProducts.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => numbatrakCustomerOrders.id, { onDelete: "set null" }),
    note: text("note"),
    occurredAt: date("occurred_at").notNull().default(sql`CURRENT_DATE`),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    // Soft backlinks only - no FK in source (agent_expenses migrated below;
    // general_expenses' source table no longer exists in schema_baseline.sql).
    legacyAgentExpenseId: bigint("legacy_agent_expense_id", { mode: "number" }),
    legacyGeneralExpenseId: bigint("legacy_general_expense_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    // Stabilization additions (migration 20260720220000)
    sourceType: text("source_type").notNull().default("manual"),
    sourceId: text("source_id"),
    offerName: text("offer_name"),
    platform: text("platform"),
  },
  (table) => [
    index("numbatrak_unified_expenses_agent_idx")
      .on(table.agentId)
      .where(sql`${table.scope} = 'agent'`),
    index("numbatrak_unified_expenses_cat_idx").on(table.organizationId, table.category),
    index("numbatrak_unified_expenses_org_idx").on(table.organizationId, table.occurredAt),
    uniqueIndex("numbatrak_unified_expenses_agent_legacy_unique_idx")
      .on(table.legacyAgentExpenseId)
      .where(sql`${table.legacyAgentExpenseId} IS NOT NULL`),
    uniqueIndex("numbatrak_unified_expenses_general_legacy_unique_idx")
      .on(table.legacyGeneralExpenseId)
      .where(sql`${table.legacyGeneralExpenseId} IS NOT NULL`),
    // Idempotent auto-feed dedup key (waybill fee / failed delivery / wallet net-off).
    uniqueIndex("numbatrak_unified_expenses_source_dedup_unique_idx")
      .on(table.organizationId, table.sourceType, table.sourceId)
      .where(sql`${table.sourceId} IS NOT NULL AND ${table.sourceType} <> 'manual'`),
    check("numbatrak_unified_expenses_scope_chk", sql`${table.scope} IN ('org', 'agent')`),
    check(
      "numbatrak_unified_expenses_org_category_chk",
      sql`${table.scope} <> 'org' OR ${table.category} IN ('operational', 'building', 'marketing', 'advertising')`,
    ),
    check("numbatrak_unified_expenses_agent_category_chk", sql`${table.scope} <> 'agent' OR ${table.category} = 'operational'`),
  ],
);

// Org-defined subcategories under each of the four parent categories.
export const numbatrakExpenseSubcategories = pgTable(
  "numbatrak_expense_subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    parentCategory: text("parent_category").notNull(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_expense_subcategories_org_idx").on(table.organizationId, table.parentCategory),
    uniqueIndex("numbatrak_expense_subcategories_org_parent_slug_unique_idx").on(
      table.organizationId,
      table.parentCategory,
      table.slug,
    ),
    check(
      "numbatrak_expense_subcategories_parent_chk",
      sql`${table.parentCategory} IN ('operational', 'building', 'marketing', 'advertising')`,
    ),
    check(
      "numbatrak_expense_subcategories_slug_nonempty_chk",
      sql`length(trim(${table.slug})) > 0 AND length(trim(${table.label})) > 0`,
    ),
  ],
);

// Legacy per-agent expense rows - see file header. Still live-written by
// src/services/expenses.ts; migrated as-is, unreconciled with unified_expenses.
export const numbatrakAgentExpensesLegacy = pgTable(
  "numbatrak_agent_expenses_legacy",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    agentId: bigint("agent_id", { mode: "number" }).references(() => numbatrakAgents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_agent_expenses_legacy_agent_idx").on(table.agentId),
    index("numbatrak_agent_expenses_legacy_date_idx").on(table.date),
    index("numbatrak_agent_expenses_legacy_org_idx").on(table.organizationId),
    check("numbatrak_agent_expenses_legacy_amount_chk", sql`${table.amount} >= 0`),
  ],
);
