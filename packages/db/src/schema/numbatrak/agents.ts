// Numbatrak domain: delivery agents (Supabase table `public.agents`, stabilized
// through supabase/migrations/20260629140000, 20260720140000, 20260720170000).
// Agents are delivery-partner records, not staff/login accounts - they never
// reference `user`. `id` stays bigint (identity) to match every other
// Numbatrak table's `agent_id bigint` FK columns without a cast.
import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakAgents = pgTable(
  "numbatrak_agents",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Free-text list of areas served; `state` below is the single primary
    // state/region used for reporting roll-ups.
    locations: text("locations"),
    state: text("state"),
    // Soft-deactivate: preserve history, exclude from new order/delivery assignment.
    active: boolean("active").notNull().default(true),
    // Org warehouse/HQ holder - holds stock, never receives customer deliveries.
    isWarehouse: boolean("is_warehouse").notNull().default(false),
    canDeliver: boolean("can_deliver").notNull().default(true),
    contactPerson: text("contact_person"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_agents_name_idx").on(table.name),
    index("numbatrak_agents_org_idx").on(table.organizationId),
    index("numbatrak_agents_active_idx").on(table.active),
    // Source: idx_agents_one_warehouse_per_org - at most one warehouse agent per org.
    uniqueIndex("numbatrak_agents_one_warehouse_per_org_idx")
      .on(table.organizationId)
      .where(sql`${table.isWarehouse} = true`),
  ],
);

// Source: public.csr_name_aliases - best-effort text-to-user matching used by
// import tooling (scripts/importWaybills.js, scripts/migrations/004, 006) to
// resolve a free-text CSR name column into a user id. Not queried by the live
// app UI directly, but the `resolve_csr_user_id` DB function depends on it.
export const numbatrakCsrNameAliases = pgTable(
  "numbatrak_csr_name_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    matchPattern: text("match_pattern").notNull(),
    // Source FK target was auth.users(id) -> public.user_profiles(id); both are
    // the same physical user identity as better-auth's `user.id` post auth-migration.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("numbatrak_csr_name_aliases_org_pattern_idx").on(table.organizationId, table.matchPattern)],
);
