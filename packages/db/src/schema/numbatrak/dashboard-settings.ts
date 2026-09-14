import { numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";

// One row per org. Previously lived in the frontend's localStorage only (see
// docs/PHASE-CURRENT-STABILIZATION.md) - moved server-side so the same
// thresholds are shared across every device/user in an org, not just the one
// browser that last saved them. Defaults mirror
// apps/numbatrak/numbatrak/src/constants/dashboardAlerts.ts's
// DEFAULT_DASHBOARD_ALERT_THRESHOLDS.
export const numbatrakDashboardAlertThresholds = pgTable(
  "numbatrak_dashboard_alert_thresholds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    deliveryRateGreen: numeric("delivery_rate_green", { precision: 14, scale: 4 }).notNull().default("70"),
    deliveryRateAmber: numeric("delivery_rate_amber", { precision: 14, scale: 4 }).notNull().default("50"),
    deliveryRateAlert: numeric("delivery_rate_alert", { precision: 14, scale: 4 }).notNull().default("65"),
    roasGreen: numeric("roas_green", { precision: 14, scale: 4 }).notNull().default("3"),
    roasAmber: numeric("roas_amber", { precision: 14, scale: 4 }).notNull().default("1.5"),
    profitPerOrderGreen: numeric("profit_per_order_green", { precision: 14, scale: 4 }).notNull().default("500"),
    profitPerOrderAmber: numeric("profit_per_order_amber", { precision: 14, scale: 4 }).notNull().default("0"),
    businessRoiGreen: numeric("business_roi_green", { precision: 14, scale: 4 }).notNull().default("0.2"),
    businessRoiAmber: numeric("business_roi_amber", { precision: 14, scale: 4 }).notNull().default("0"),
    realCpaAovGreen: numeric("real_cpa_aov_green", { precision: 14, scale: 4 }).notNull().default("0.35"),
    realCpaAovAmber: numeric("real_cpa_aov_amber", { precision: 14, scale: 4 }).notNull().default("0.55"),
    minUndeliveredForAlert: numeric("min_undelivered_for_alert", { precision: 14, scale: 4 }).notNull().default("3"),
    minWouldBeSalesForAlert: numeric("min_would_be_sales_for_alert", { precision: 14, scale: 4 })
      .notNull()
      .default("25000"),
    cpaWeekOnWeekIncreasePct: numeric("cpa_week_on_week_increase_pct", { precision: 14, scale: 4 })
      .notNull()
      .default("15"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("numbatrak_dashboard_alert_thresholds_org_unique_idx").on(table.organizationId),
  ],
);
