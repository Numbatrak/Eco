// Numbatrak domain: Wallet / agent remittance. Source `public.wallet_remittance_lines`
// (migration 20260720150000) - one row per agent per calendar day of
// agent-collected COD deliveries.
import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakAgents } from "./agents.js";
import { numbatrakUnifiedExpenses } from "./expenses.js";

export const numbatrakWalletRemittanceLines = pgTable(
  "numbatrak_wallet_remittance_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // ANOMALY (flagged in migration report): source column is `integer`
    // referencing numbatrak_agents.id, which is `bigint` - a narrower FK type
    // than its target. Preserved verbatim (works today only because agent ids
    // haven't exceeded int4 range).
    agentId: integer("agent_id")
      .notNull()
      .references(() => numbatrakAgents.id, { onDelete: "cascade" }),
    remittanceDate: date("remittance_date").notNull(),
    totalDeliveredValue: numeric("total_delivered_value", { precision: 14, scale: 2 }).notNull().default("0"),
    totalDeliveryFees: numeric("total_delivery_fees", { precision: 14, scale: 2 }).notNull().default("0"),
    netOffAmount: numeric("net_off_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    expectedRemittance: numeric("expected_remittance", { precision: 14, scale: 2 }).notNull().default("0"),
    actualAmount: numeric("actual_amount", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("standing"),
    netOffExpenseId: uuid("net_off_expense_id").references(() => numbatrakUnifiedExpenses.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    remittedAt: timestamp("remitted_at", { withTimezone: true }),
    remittedBy: text("remitted_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_wallet_remittance_lines_org_date_idx").on(table.organizationId, table.remittanceDate),
    index("numbatrak_wallet_remittance_lines_org_agent_idx").on(table.organizationId, table.agentId),
    uniqueIndex("numbatrak_wallet_remittance_lines_org_agent_date_unique_idx").on(
      table.organizationId,
      table.agentId,
      table.remittanceDate,
    ),
    check(
      "numbatrak_wallet_remittance_lines_status_chk",
      sql`${table.status} IN ('standing', 'remitted', 'short', 'net_owed')`,
    ),
  ],
);
