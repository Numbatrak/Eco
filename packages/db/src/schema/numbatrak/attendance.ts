import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organization, user } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

export const numbatrakAttendanceSettings = pgTable(
  "numbatrak_attendance_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    autoCloseWindowMinutes: integer("auto_close_window_minutes").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_attendance_settings_org_unique_idx").on(table.organizationId),
  ],
);

export const numbatrakAttendanceEvents = pgTable(
  "numbatrak_attendance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_attendance_events_org_idx").on(table.organizationId),
    index("numbatrak_attendance_events_date_idx").on(table.eventDate),
    sql`CHECK (${table.status} IN ('open', 'closed'))`,
  ],
);

export const numbatrakAttendanceRecords = pgTable(
  "numbatrak_attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => numbatrakAttendanceEvents.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    markedAt: timestamp("marked_at", { withTimezone: true }),
    markedBy: text("marked_by").references(() => user.id, { onDelete: "set null" }),
    exemptReason: text("exempt_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_attendance_records_event_staff_unique_idx").on(table.eventId, table.staffId),
    index("numbatrak_attendance_records_event_idx").on(table.eventId),
    index("numbatrak_attendance_records_staff_idx").on(table.staffId),
    sql`CHECK (${table.status} IN ('present', 'late', 'absent', 'exempt'))`,
  ],
);
