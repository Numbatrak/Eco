// Numbatrak domain schema - Phase 1 (schema translation + data migration only).
//
// Scope: business/domain tables only. Deliberately excludes anything in the
// auth/identity/membership domain (organization_members, organization_invitations,
// user_profiles, email_verification_otps) - those are handled in the later
// auth migration phase per task scope. Every "who did this" column below
// (csrId, assignedTo, recordedByUserId, createdBy, remittedBy, userId, etc.)
// references the existing better-auth `user.id` directly rather than a new
// numbatrak-namespaced user table - see MIGRATION_REPORT.md for why, and for
// the hard dependency this creates on the auth migration phase running first.
//
// Every table is prefixed `numbatrak_` at the SQL level to avoid name
// collisions with the platform's own commerce tables, which already use the
// generic names `products`, `orders`, `customers`, `expenses`, etc.
export * from "./agents.js";
export * from "./products.js";
export * from "./forms.js";
export * from "./orders.js";
export * from "./inventory.js";
export * from "./deliveries.js";
export * from "./wallet.js";
export * from "./expenses.js";
export * from "./abandoned-carts.js";
export * from "./follow-ups.js";
export * from "./order-assignment.js";
export * from "./activities.js";
export * from "./staff.js";
export * from "./payroll.js";
export * from "./attendance.js";
export * from "./strikes.js";
export * from "./stars.js";
export * from "./leave.js";

import { numbatrakAgents, numbatrakCsrNameAliases } from "./agents.js";
import {
  numbatrakProducts,
  numbatrakProductVariants,
  numbatrakProductOffers,
  numbatrakProductPriceHistory,
} from "./products.js";
import { numbatrakForms, numbatrakFormProducts } from "./forms.js";
import {
  numbatrakFormResponses,
  numbatrakFormResponseItems,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  numbatrakOrderInventoryConsumption,
} from "./orders.js";
import { numbatrakInventoryLots, numbatrakStockMovements, numbatrakInventoryLegacy } from "./inventory.js";
import { numbatrakDeliveries } from "./deliveries.js";
import { numbatrakWalletRemittanceLines } from "./wallet.js";
import {
  numbatrakUnifiedExpenses,
  numbatrakExpenseSubcategories,
  numbatrakAgentExpensesLegacy,
} from "./expenses.js";
import { numbatrakAbandonedCarts } from "./abandoned-carts.js";
import { numbatrakFollowUps } from "./follow-ups.js";
import { numbatrakOrderAssignmentSettings, numbatrakOrderAssignmentWeights } from "./order-assignment.js";
import { numbatrakActivities } from "./activities.js";
import { numbatrakStaff, numbatrakStaffSubBrands } from "./staff.js";
import { numbatrakPayStructures, numbatrakPayrollRuns, numbatrakPayrollLines } from "./payroll.js";
import { numbatrakAttendanceSettings, numbatrakAttendanceEvents, numbatrakAttendanceRecords } from "./attendance.js";
import { numbatrakStrikeSettings, numbatrakStrikes } from "./strikes.js";
import { numbatrakStarSettings, numbatrakStarTiers, numbatrakStars } from "./stars.js";
import { numbatrakLeaveSettings, numbatrakLeaveBalances, numbatrakLeaveRequests } from "./leave.js";

// Flat aggregate for merging into the main `schema` object in ../../schema.ts
// (drizzle(client, { schema }) needs every table as a top-level key for
// db.query.<table> relational queries to work).
export const numbatrakSchema = {
  numbatrakAgents,
  numbatrakCsrNameAliases,
  numbatrakProducts,
  numbatrakProductVariants,
  numbatrakProductOffers,
  numbatrakProductPriceHistory,
  numbatrakForms,
  numbatrakFormProducts,
  numbatrakFormResponses,
  numbatrakFormResponseItems,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  numbatrakOrderInventoryConsumption,
  numbatrakInventoryLots,
  numbatrakStockMovements,
  numbatrakInventoryLegacy,
  numbatrakDeliveries,
  numbatrakWalletRemittanceLines,
  numbatrakUnifiedExpenses,
  numbatrakExpenseSubcategories,
  numbatrakAgentExpensesLegacy,
  numbatrakAbandonedCarts,
  numbatrakFollowUps,
  numbatrakOrderAssignmentSettings,
  numbatrakOrderAssignmentWeights,
  numbatrakActivities,
  numbatrakStaff,
  numbatrakStaffSubBrands,
  numbatrakPayStructures,
  numbatrakPayrollRuns,
  numbatrakPayrollLines,
  numbatrakAttendanceSettings,
  numbatrakAttendanceEvents,
  numbatrakAttendanceRecords,
  numbatrakStrikeSettings,
  numbatrakStrikes,
  numbatrakStarSettings,
  numbatrakStarTiers,
  numbatrakStars,
  numbatrakLeaveSettings,
  numbatrakLeaveBalances,
  numbatrakLeaveRequests,
};
