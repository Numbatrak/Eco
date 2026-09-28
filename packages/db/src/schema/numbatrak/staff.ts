// Numbatrak domain: internal team/HR records ("Staff"), distinct from
// `numbatrakAgents` (external delivery partners, no login - see agents.ts's
// own header comment). Net-new per the Feature Spec's Staff Management
// suite (spec §7) - no source Supabase table for this, since HR/staff data
// was never part of the ported system.
//
// Deliberately does NOT touch the actual authorization boundary: `member.role`
// (../../auth-schema.js) stays the sole real permission gate via
// requireOrgPermission. `primaryRole`/`extraRoles` here are the spec's
// six-role vocabulary (CRS/Manager/Admin/Media/Accountant/Founder) as
// HR/reporting/nav-gating metadata, validated for compatibility against the
// member's real role at the application layer, not a new enforcement path.
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakStaff = pgTable(
  "numbatrak_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // The login account this HR record is for - one staff record per member
    // (see the unique index below), never a standalone person with no login.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Six-role model (spec-wide grouping, not the auth system's own role enum).
    primaryRole: text("primary_role").notNull(),
    // Optional additional roles this person also covers - access union is a
    // reporting/nav-gating concept only in this phase, not an auth grant.
    extraRoles: jsonb("extra_roles").notNull().default([]),
    phone: text("phone"),
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    bankAccountName: text("bank_account_name"),
    active: boolean("active").notNull().default(true),
    // Finer-grained HR status than `active` alone. `active` stays the one
    // real gate everything else (payroll, scoping) already checks -
    // employmentStatus is additional detail layered on top, kept in sync by
    // the staff service (not a DB trigger): 'inactive'/'suspended' force
    // active=false, 'active'/'on_leave' force active=true.
    employmentStatus: text("employment_status").notNull().default("active"),
    onProbation: boolean("on_probation").notNull().default(false),
    probationEndsAt: timestamp("probation_ends_at", { withTimezone: true }),
    // Audit trail for the most recent deactivation - who and why, not a full
    // history (that would need its own log table; this covers "why is this
    // person inactive" at a glance, the common case). Cleared back to null
    // when the person is reactivated.
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivatedBy: text("deactivated_by").references(() => user.id, { onDelete: "set null" }),
    deactivationReason: text("deactivation_reason"),
    // Reporting hierarchy for the spec's "managers see their team" scoping
    // (Staff/Strikes/Leave). Self-referencing, nullable (top-level staff and
    // orgs that don't use hierarchy leave this null, which existing
    // "manager = org-wide" scoping still falls back to). Set null on the
    // manager's own deactivation/removal rather than cascading deletes onto
    // their reports.
    managerId: uuid("manager_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_staff_org_idx").on(table.organizationId),
    index("numbatrak_staff_user_idx").on(table.userId),
    index("numbatrak_staff_manager_idx").on(table.managerId),
    uniqueIndex("numbatrak_staff_org_user_unique_idx").on(table.organizationId, table.userId),
    check(
      "numbatrak_staff_primary_role_chk",
      sql`${table.primaryRole} IN ('CRS', 'Manager', 'Admin', 'Media', 'Accountant', 'Founder')`,
    ),
    check(
      "numbatrak_staff_employment_status_chk",
      sql`${table.employmentStatus} IN ('active', 'inactive', 'suspended', 'on_leave')`,
    ),
    check("numbatrak_staff_manager_not_self_chk", sql`${table.managerId} IS NULL OR ${table.managerId} <> ${table.id}`),
    foreignKey({ columns: [table.managerId], foreignColumns: [table.id], name: "numbatrak_staff_manager_fk" }).onDelete(
      "set null",
    ),
  ],
);

// A staff member can cover multiple sub-brands (a primary plus extras, per
// the spec) - every other Numbatrak table's sub_brand is a single nullable
// column, but this one is genuinely multi-valued, hence a join table rather
// than reusing that pattern.
export const numbatrakStaffSubBrands = pgTable(
  "numbatrak_staff_sub_brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),
    subBrand: text("sub_brand").notNull(),
  },
  (table) => [
    index("numbatrak_staff_sub_brands_staff_idx").on(table.staffId),
    uniqueIndex("numbatrak_staff_sub_brands_staff_brand_unique_idx").on(table.staffId, table.subBrand),
  ],
);
