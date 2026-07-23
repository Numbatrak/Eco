// Numbatrak domain: Payroll - the flexible pay-component engine (spec
// feature 4). Net-new, no source Supabase table (the HR system Numbatrak
// grew out of had this, but it was never migrated into this repo). Depends
// on numbatrakStaff (staff.ts) for who gets paid, and on
// numbatrakCustomerOrders/OrderItems (orders.ts) for the live data that
// feeds commission/delivery-rate/upsell-count calculation.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakStaff } from "./staff.js";

// One row per (org, role-tier) OR (org, staff-specific override). A staff
// member's effective pay structure is their own override if one exists,
// else their primaryRole's tier structure, else none (excluded from
// calculation - the spec's "Empty" state).
export const numbatrakPayStructures = pgTable(
  "numbatrak_pay_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    // Six-role spec vocabulary, set only when scopeType='role'.
    role: text("role"),
    staffId: uuid("staff_id").references(() => numbatrakStaff.id, { onDelete: "cascade" }),

    baseSalaryEnabled: boolean("base_salary_enabled").notNull().default(false),
    baseSalaryAmount: numeric("base_salary_amount", { precision: 14, scale: 2 }).notNull().default("0"),

    commissionEnabled: boolean("commission_enabled").notNull().default(false),
    // 'flat_per_order' | 'percentage_of_sale'.
    commissionBasis: text("commission_basis"),
    commissionRate: numeric("commission_rate", { precision: 14, scale: 4 }).notNull().default("0"),
    commissionGateEnabled: boolean("commission_gate_enabled").notNull().default(false),
    commissionGateThresholdPercent: numeric("commission_gate_threshold_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),

    upsellBonusEnabled: boolean("upsell_bonus_enabled").notNull().default(false),
    upsellBonusAmount: numeric("upsell_bonus_amount", { precision: 14, scale: 2 }).notNull().default("0"),

    sotmBonusEnabled: boolean("sotm_bonus_enabled").notNull().default(false),
    sotmBonusAmount: numeric("sotm_bonus_amount", { precision: 14, scale: 2 }).notNull().default("0"),

    // Manager bonus - a standalone component (not a modifier on commission),
    // gated by team ratio when managerGateEnabled is on. "Team" = every
    // active CRS-primary-role staff org-wide, since no reporting hierarchy
    // exists anywhere in this schema; "hit KPI" = that team member's own
    // delivery rate for the month >= managerGateKpiThresholdPercent.
    managerBonusEnabled: boolean("manager_bonus_enabled").notNull().default(false),
    managerBonusAmount: numeric("manager_bonus_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    managerGateEnabled: boolean("manager_gate_enabled").notNull().default(false),
    managerGateTeamRatioPercent: numeric("manager_gate_team_ratio_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("50"),
    managerGateKpiThresholdPercent: numeric("manager_gate_kpi_threshold_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_pay_structures_org_idx").on(table.organizationId),
    index("numbatrak_pay_structures_staff_idx").on(table.staffId),
    uniqueIndex("numbatrak_pay_structures_org_role_unique_idx")
      .on(table.organizationId, table.role)
      .where(sql`${table.scopeType} = 'role'`),
    uniqueIndex("numbatrak_pay_structures_org_staff_unique_idx")
      .on(table.organizationId, table.staffId)
      .where(sql`${table.scopeType} = 'staff'`),
    check("numbatrak_pay_structures_scope_type_chk", sql`${table.scopeType} IN ('role', 'staff')`),
    check(
      "numbatrak_pay_structures_role_chk",
      sql`${table.role} IS NULL OR ${table.role} IN ('CRS', 'Manager', 'Admin', 'Media', 'Accountant', 'Founder')`,
    ),
    check(
      "numbatrak_pay_structures_commission_basis_chk",
      sql`${table.commissionBasis} IS NULL OR ${table.commissionBasis} IN ('flat_per_order', 'percentage_of_sale')`,
    ),
    check(
      "numbatrak_pay_structures_scope_shape_chk",
      sql`(${table.scopeType} = 'role' AND ${table.role} IS NOT NULL AND ${table.staffId} IS NULL)
        OR (${table.scopeType} = 'staff' AND ${table.staffId} IS NOT NULL AND ${table.role} IS NULL)`,
    ),
  ],
);

// One per (org, month) - a payroll run for that calendar month.
export const numbatrakPayrollRuns = pgTable(
  "numbatrak_payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // 'YYYY-MM'.
    month: text("month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_payroll_runs_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_payroll_runs_org_month_unique_idx").on(table.organizationId, table.month),
  ],
);

// One per (run, staff) - the calculated/overridden pay line for one person
// in one month's run. Overrides live in separate columns from the
// calculated ones so re-running payroll (which only ever updates
// calculated*/trace columns) can never destructively clobber an override,
// a paid flag, a manual adjustment, or an SOTM award - "reversible, sticks
// through re-run" is true by construction, not by convention.
export const numbatrakPayrollLines = pgTable(
  "numbatrak_payroll_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => numbatrakPayrollRuns.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => numbatrakStaff.id, { onDelete: "cascade" }),

    calculatedBaseSalary: numeric("calculated_base_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    // Post-gate: already zeroed if the commission gate was missed.
    calculatedCommission: numeric("calculated_commission", { precision: 14, scale: 2 }).notNull().default("0"),
    calculatedUpsellBonus: numeric("calculated_upsell_bonus", { precision: 14, scale: 2 }).notNull().default("0"),
    calculatedSotmBonus: numeric("calculated_sotm_bonus", { precision: 14, scale: 2 }).notNull().default("0"),
    calculatedManagerBonus: numeric("calculated_manager_bonus", { precision: 14, scale: 2 }).notNull().default("0"),

    // Per spec, only base + commission are overridable.
    overrideBaseSalary: numeric("override_base_salary", { precision: 14, scale: 2 }),
    overrideCommission: numeric("override_commission", { precision: 14, scale: 2 }),

    manualAdjustment: numeric("manual_adjustment", { precision: 14, scale: 2 }).notNull().default("0"),
    manualAdjustmentNote: text("manual_adjustment_note"),

    deliveryRatePercent: numeric("delivery_rate_percent", { precision: 5, scale: 2 }),
    commissionGateMissed: boolean("commission_gate_missed").notNull().default(false),
    upsellCount: integer("upsell_count").notNull().default(0),
    managerGateMissed: boolean("manager_gate_missed"),
    sotmAwarded: boolean("sotm_awarded").notNull().default(false),

    // Deactivate-style, not a hard lock: marking paid never blocks further
    // edits or a re-send (mirrors Staff's own deactivate-not-delete
    // precedent for "don't destroy editability").
    paid: boolean("paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_payroll_lines_run_idx").on(table.runId),
    index("numbatrak_payroll_lines_staff_idx").on(table.staffId),
    uniqueIndex("numbatrak_payroll_lines_run_staff_unique_idx").on(table.runId, table.staffId),
  ],
);
