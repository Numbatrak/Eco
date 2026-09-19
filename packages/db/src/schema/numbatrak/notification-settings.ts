import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";

// One row per org. Controls whether apps/api's
// numbatrak-dashboard/lib/daily-summary.ts (runDailySummaryEmails) sends the
// org its daily summary email, and who besides the org owner also receives
// it. Previously there was no way to opt out or add extra recipients - every
// active org's owner was always emailed, unconditionally.
export const numbatrakNotificationSettings = pgTable(
  "numbatrak_notification_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    dailySummaryEnabled: boolean("daily_summary_enabled").notNull().default(true),
    additionalRecipients: text("additional_recipients"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_notification_settings_org_unique_idx").on(table.organizationId),
  ],
);
