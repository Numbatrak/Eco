import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

export const numbatrakLeaveSettings = pgTable(
  "numbatrak_leave_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    annualDays: integer("annual_days").notNull().default(20),
    sickDays: integer("sick_days").notNull().default(10),
    emergencyDays: integer("emergency_days").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_leave_settings_org_unique_idx").on(table.organizationId),
  ],
);

export const numbatrakLeaveBalances = pgTable(
  "numbatrak_leave_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    annualUsed: integer("annual_used").notNull().default(0),
    sickUsed: integer("sick_used").notNull().default(0),
    emergencyUsed: integer("emergency_used").notNull().default(0),
    unpaidUsed: integer("unpaid_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_leave_balances_org_staff_year_unique_idx").on(
      table.organizationId,
      table.staffId,
      table.year,
    ),
    index("numbatrak_leave_balances_org_idx").on(table.organizationId),
    index("numbatrak_leave_balances_staff_idx").on(table.staffId),
  ],
);

export const numbatrakLeaveRequests = pgTable(
  "numbatrak_leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    leaveType: text("leave_type").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    days: integer("days").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_leave_requests_org_idx").on(table.organizationId),
    index("numbatrak_leave_requests_staff_idx").on(table.staffId),
    index("numbatrak_leave_requests_status_idx").on(table.status),
    check(
      "numbatrak_leave_requests_type_chk",
      sql`${table.leaveType} IN ('annual', 'sick', 'emergency', 'unpaid')`,
    ),
    check(
      "numbatrak_leave_requests_status_chk",
      sql`${table.status} IN ('pending', 'approved', 'declined')`,
    ),
  ],
);
