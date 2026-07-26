// Numbatrak domain: audit/activity feed. Source `public.activities`
// (migration 20260612120000, FK repointed to user_profiles by 20260629160000
// for PostgREST embedding - translated here to `user`).
import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakActivities = pgTable(
  "numbatrak_activities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userName: text("user_name"),
    actionType: text("action_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: bigint("entity_id", { mode: "number" }),
    description: text("description").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("numbatrak_activities_org_created_idx").on(table.organizationId, table.createdAt)],
);
