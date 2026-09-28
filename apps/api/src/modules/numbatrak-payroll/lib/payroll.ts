import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyBaseLogger } from "fastify";
import {
  numbatrakPayStructures,
  numbatrakPayrollRuns,
  numbatrakPayrollLines,
  numbatrakStaff,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  numbatrakAdSpend,
  user,
  type Database,
  type Queryable,
} from "@platform/db";
import { getDirectReportStaffIds } from "../../numbatrak-staff/lib/staff.js";
import type {
  NumbatrakPayStructure,
  NumbatrakPayrollRun,
  NumbatrakPayrollLine,
  NumbatrakMyEarnings,
  NumbatrakPayrollTrace,
  NumbatrakPayrollTraceStep,
} from "@platform/shared-types";
import { sendEmail } from "../../auth/lib/email.js";
import { payslipEmail } from "../../../lib/email-templates.js";

type PayStructureRow = typeof numbatrakPayStructures.$inferSelect;
type PayrollLineRow = typeof numbatrakPayrollLines.$inferSelect;
type PayrollRunRow = typeof numbatrakPayrollRuns.$inferSelect;

const paidByUser = alias(user, "paid_by_user");
const closedByUser = alias(user, "closed_by_user");

function serializeRun(run: PayrollRunRow, lines: NumbatrakPayrollLine[], closedByName: string | null): NumbatrakPayrollRun {
  return {
    id: run.id,
    month: run.month,
    status: run.status as NumbatrakPayrollRun["status"],
    closedAt: run.closedAt?.toISOString() ?? null,
    closedByName,
    lines,
    createdAt: run.createdAt?.toISOString() ?? null,
    updatedAt: run.updatedAt?.toISOString() ?? null,
  };
}

/** Throws if this org's month is closed - every mutating payroll action must call this before writing. */
async function assertPeriodOpen(db: Queryable, organizationId: string, month: string): Promise<void> {
  const [run] = await db
    .select({ status: numbatrakPayrollRuns.status })
    .from(numbatrakPayrollRuns)
    .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
    .limit(1);
  if (run?.status === "closed") {
    throw new Error(`Payroll for ${month} is closed. Reopen the period before making changes.`);
  }
}

/**
 * Resolves a payroll line's (organizationId, month), throwing 404-equivalent
 * if the line doesn't belong to this org - closes the cross-tenant gap where
 * override/adjustment/sotm/markPaid previously trusted any lineId under only
 * an org-level permission check, never verifying the line itself was in that
 * org. Also asserts the period isn't closed, in one place every mutator uses.
 */
async function assertLineMutable(
  db: Queryable,
  organizationId: string,
  lineId: string,
): Promise<{ month: string }> {
  const [row] = await db
    .select({ month: numbatrakPayrollRuns.month, status: numbatrakPayrollRuns.status })
    .from(numbatrakPayrollLines)
    .innerJoin(numbatrakPayrollRuns, eq(numbatrakPayrollLines.runId, numbatrakPayrollRuns.id))
    .where(and(eq(numbatrakPayrollLines.id, lineId), eq(numbatrakPayrollRuns.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new Error("Payroll line not found.");
  if (row.status === "closed") {
    throw new Error(`Payroll for ${row.month} is closed. Reopen the period before making changes.`);
  }
  return { month: row.month };
}

function serializePayStructure(row: PayStructureRow, staffName?: string | null): NumbatrakPayStructure {
  return {
    id: row.id,
    scopeType: row.scopeType as NumbatrakPayStructure["scopeType"],
    role: row.role as NumbatrakPayStructure["role"],
    staffId: row.staffId,
    staffName: staffName ?? null,
    baseSalaryEnabled: row.baseSalaryEnabled,
    baseSalaryAmount: Number(row.baseSalaryAmount),
    commissionEnabled: row.commissionEnabled,
    commissionBasis: row.commissionBasis as NumbatrakPayStructure["commissionBasis"],
    commissionRate: Number(row.commissionRate),
    commissionGateEnabled: row.commissionGateEnabled,
    commissionGateThresholdPercent: Number(row.commissionGateThresholdPercent),
    upsellBonusEnabled: row.upsellBonusEnabled,
    upsellBonusAmount: Number(row.upsellBonusAmount),
    sotmBonusEnabled: row.sotmBonusEnabled,
    sotmBonusAmount: Number(row.sotmBonusAmount),
    managerBonusEnabled: row.managerBonusEnabled,
    managerBonusAmount: Number(row.managerBonusAmount),
    managerGateEnabled: row.managerGateEnabled,
    managerGateTeamRatioPercent: Number(row.managerGateTeamRatioPercent),
    managerGateKpiThresholdPercent: Number(row.managerGateKpiThresholdPercent),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeLine(
  row: PayrollLineRow,
  staffName: string | null,
  primaryRole: string | null,
  runId: string,
  paidByName: string | null = null,
): NumbatrakPayrollLine {
  const baseSalary = row.overrideBaseSalary != null ? Number(row.overrideBaseSalary) : Number(row.calculatedBaseSalary);
  const commission = row.overrideCommission != null ? Number(row.overrideCommission) : Number(row.calculatedCommission);
  const upsell = Number(row.calculatedUpsellBonus);
  const sotm = Number(row.calculatedSotmBonus);
  const manager = Number(row.calculatedManagerBonus);
  const adjustment = Number(row.manualAdjustment);
  const totalPay = baseSalary + commission + upsell + sotm + manager + adjustment;

  return {
    id: row.id,
    runId,
    staffId: row.staffId,
    staffName,
    primaryRole: primaryRole as NumbatrakPayrollLine["primaryRole"],
    calculatedBaseSalary: Number(row.calculatedBaseSalary),
    calculatedCommission: Number(row.calculatedCommission),
    calculatedUpsellBonus: upsell,
    calculatedSotmBonus: sotm,
    calculatedManagerBonus: manager,
    overrideBaseSalary: row.overrideBaseSalary != null ? Number(row.overrideBaseSalary) : null,
    overrideCommission: row.overrideCommission != null ? Number(row.overrideCommission) : null,
    manualAdjustment: adjustment,
    manualAdjustmentNote: row.manualAdjustmentNote,
    deliveryRatePercent: row.deliveryRatePercent != null ? Number(row.deliveryRatePercent) : null,
    commissionGateMissed: row.commissionGateMissed,
    upsellCount: row.upsellCount,
    managerGateMissed: row.managerGateMissed,
    sotmAwarded: row.sotmAwarded,
    paid: row.paid,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidAmount: row.paidAmount != null ? Number(row.paidAmount) : null,
    paidByName,
    paidNotes: row.paidNotes,
    totalPay,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export type PayrollScope = { all: true } | { all: false; ownUserId: string };

export async function listPayStructures(
  db: Database,
  organizationId: string,
  scope: PayrollScope = { all: true },
): Promise<NumbatrakPayStructure[]> {
  const rows = await db
    .select()
    .from(numbatrakPayStructures)
    .where(eq(numbatrakPayStructures.organizationId, organizationId));

  if (scope.all) return rows.map((row) => serializePayStructure(row));

  // Row-scoped: only the caller's own staff-specific override (if any) and
  // their own role's tier structure - same "own record only" boundary as
  // numbatrak-staff's list route, applied to pay rates instead of HR fields.
  const [staffRow] = await db
    .select()
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.userId, scope.ownUserId)))
    .limit(1);
  if (!staffRow) return [];

  return rows
    .filter(
      (row) =>
        (row.scopeType === "staff" && row.staffId === staffRow.id) ||
        (row.scopeType === "role" && row.role === staffRow.primaryRole),
    )
    .map((row) => serializePayStructure(row));
}

export async function upsertPayStructure(
  db: Database,
  organizationId: string,
  input: Partial<typeof numbatrakPayStructures.$inferInsert> & { scopeType: string; role?: string | null; staffId?: string | null },
): Promise<NumbatrakPayStructure> {
  return db.transaction(async (tx) => {
    const conditions = [eq(numbatrakPayStructures.organizationId, organizationId)];
    if (input.scopeType === "role" && input.role) {
      conditions.push(
        eq(numbatrakPayStructures.scopeType, "role"),
        eq(numbatrakPayStructures.role, input.role),
      );
    } else if (input.scopeType === "staff" && input.staffId) {
      conditions.push(
        eq(numbatrakPayStructures.scopeType, "staff"),
        eq(numbatrakPayStructures.staffId, input.staffId),
      );
    }

    const [existing] = await tx
      .select()
      .from(numbatrakPayStructures)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const [row] = await tx
        .update(numbatrakPayStructures)
        .set({ ...input, organizationId, updatedAt: new Date() })
        .where(eq(numbatrakPayStructures.id, existing.id))
        .returning();
      return serializePayStructure(row!);
    }

    const [row] = await tx
      .insert(numbatrakPayStructures)
      .values({ ...input, organizationId } as typeof numbatrakPayStructures.$inferInsert)
      .returning();
    return serializePayStructure(row!);
  });
}

export async function getPayrollRun(
  db: Database,
  organizationId: string,
  month: string,
  scope: PayrollScope = { all: true },
): Promise<NumbatrakPayrollRun | null> {
  const [run] = await db
    .select()
    .from(numbatrakPayrollRuns)
    .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
    .limit(1);
  if (!run) return null;

  // Row-scoped: a CSR-permissioned caller only ever gets their own line, not
  // the whole org's pay - mirrors numbatrak-orders' csrScopeUserId pattern.
  const runConditions = scope.all
    ? [eq(numbatrakPayrollLines.runId, run.id)]
    : [eq(numbatrakPayrollLines.runId, run.id), eq(numbatrakStaff.userId, scope.ownUserId)];

  const lineRows = await db
    .select({
      line: numbatrakPayrollLines,
      userName: user.name,
      primaryRole: numbatrakStaff.primaryRole,
      paidByName: paidByUser.name,
    })
    .from(numbatrakPayrollLines)
    .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .leftJoin(paidByUser, eq(numbatrakPayrollLines.paidBy, paidByUser.id))
    .where(and(...runConditions));

  const closedByName = await getUserName(db, run.closedBy);
  return serializeRun(
    run,
    lineRows.map((r) => serializeLine(r.line, r.userName, r.primaryRole, run.id, r.paidByName ?? null)),
    closedByName,
  );
}

async function getUserName(db: Queryable, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.name ?? null;
}

export async function runPayroll(db: Database, organizationId: string, month: string): Promise<NumbatrakPayrollRun> {
  return db.transaction(async (tx) => {
    let [run] = await tx
      .select()
      .from(numbatrakPayrollRuns)
      .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
      .limit(1);

    if (!run) {
      [run] = await tx
        .insert(numbatrakPayrollRuns)
        .values({ organizationId, month })
        .returning();
    } else {
      if (run!.status === "closed") {
        throw new Error(`Payroll for ${month} is closed. Reopen the period before recomputing.`);
      }
      await tx
        .update(numbatrakPayrollRuns)
        .set({ updatedAt: new Date() })
        .where(eq(numbatrakPayrollRuns.id, run!.id));
    }

    const activeStaff = await tx
      .select()
      .from(numbatrakStaff)
      .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.active, true)));

    const structures = await tx
      .select()
      .from(numbatrakPayStructures)
      .where(eq(numbatrakPayStructures.organizationId, organizationId));

    const roleStructures = new Map(structures.filter((s) => s.scopeType === "role").map((s) => [s.role, s]));
    const staffStructures = new Map(structures.filter((s) => s.scopeType === "staff").map((s) => [s.staffId, s]));

    for (const staff of activeStaff) {
      const ps = staffStructures.get(staff.id) ?? roleStructures.get(staff.primaryRole);
      if (!ps) continue;

      const orderData =
        staff.primaryRole === "Media"
          ? await getMediaBuyerOrderData(tx, organizationId, staff.userId, month)
          : await getStaffOrderData(tx, organizationId, staff.userId, month);
      // Team pool is this manager's own direct reports (numbatrakStaff.managerId),
      // not every CRS org-wide - only fetched when this structure actually
      // gates on it, since it's the one per-staff query in the loop.
      const teamDeliveryRates =
        ps.managerBonusEnabled && ps.managerGateEnabled
          ? await getTeamDeliveryRates(tx, organizationId, month, staff.id)
          : [];
      const calculated = calculatePay(ps, orderData, teamDeliveryRates);

      const [existing] = await tx
        .select()
        .from(numbatrakPayrollLines)
        .where(and(eq(numbatrakPayrollLines.runId, run!.id), eq(numbatrakPayrollLines.staffId, staff.id)))
        .limit(1);

      if (existing) {
        await tx
          .update(numbatrakPayrollLines)
          .set({ ...calculated, updatedAt: new Date() })
          .where(eq(numbatrakPayrollLines.id, existing.id));
      } else {
        await tx
          .insert(numbatrakPayrollLines)
          .values({ runId: run!.id, staffId: staff.id, ...calculated });
      }
    }

    const lineRows = await tx
      .select({
        line: numbatrakPayrollLines,
        userName: user.name,
        primaryRole: numbatrakStaff.primaryRole,
        paidByName: paidByUser.name,
      })
      .from(numbatrakPayrollLines)
      .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
      .innerJoin(user, eq(numbatrakStaff.userId, user.id))
      .leftJoin(paidByUser, eq(numbatrakPayrollLines.paidBy, paidByUser.id))
      .where(eq(numbatrakPayrollLines.runId, run!.id));

    const closedByName = await getUserName(tx, run!.closedBy);
    return serializeRun(
      run!,
      lineRows.map((r) => serializeLine(r.line, r.userName, r.primaryRole, run!.id, r.paidByName ?? null)),
      closedByName,
    );
  });
}

export async function closePeriod(
  db: Database,
  organizationId: string,
  month: string,
  closedByUserId: string,
): Promise<NumbatrakPayrollRun | null> {
  const [run] = await db
    .update(numbatrakPayrollRuns)
    .set({ status: "closed", closedAt: new Date(), closedBy: closedByUserId, updatedAt: new Date() })
    .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
    .returning();
  if (!run) return null;
  return getPayrollRun(db, organizationId, month);
}

export async function reopenPeriod(db: Database, organizationId: string, month: string): Promise<NumbatrakPayrollRun | null> {
  const [run] = await db
    .update(numbatrakPayrollRuns)
    .set({ status: "open", closedAt: null, closedBy: null, updatedAt: new Date() })
    .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
    .returning();
  if (!run) return null;
  return getPayrollRun(db, organizationId, month);
}

async function getStaffOrderData(
  db: Queryable,
  organizationId: string,
  userId: string,
  month: string,
) {
  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endMonth = new Date(startDate);
  endMonth.setMonth(endMonth.getMonth() + 1);
  // postgres-js's bind-parameter encoder doesn't stringify a bare JS Date
  // passed through a raw sql`` template - it throws inside
  // Buffer.byteLength at bind time. Every other value in this file goes
  // through Drizzle's typed column comparisons, which handle that
  // themselves; these date-range filters are raw sql`` so they need an
  // explicit ISO string.
  const startDateIso = startDate.toISOString();
  const endMonthIso = endMonth.toISOString();

  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`coalesce(sum(${numbatrakCustomerOrders.orderRevenue}::numeric), 0)::float`,
    })
    .from(numbatrakCustomerOrders)
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        eq(numbatrakCustomerOrders.csrId, userId),
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDateIso}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonthIso}`,
      ),
    );

  const [deliveryStats] = await db
    .select({
      deliveredCount: sql<number>`count(*)::int`,
    })
    .from(numbatrakCustomerOrders)
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        eq(numbatrakCustomerOrders.csrId, userId),
        eq(numbatrakCustomerOrders.status, "delivered"),
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDateIso}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonthIso}`,
      ),
    );

  const [upsellStats] = await db
    .select({
      upsellCount: sql<number>`coalesce(sum(${numbatrakCustomerOrderItems.quantity}::int), 0)::int`,
    })
    .from(numbatrakCustomerOrderItems)
    .innerJoin(numbatrakCustomerOrders, eq(numbatrakCustomerOrderItems.orderId, numbatrakCustomerOrders.id))
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        eq(numbatrakCustomerOrders.csrId, userId),
        sql`${numbatrakCustomerOrderItems.addedByUserId} IS NOT NULL`,
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDateIso}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonthIso}`,
      ),
    );

  const totalOrders = orderStats?.totalOrders ?? 0;
  const deliveredCount = deliveryStats?.deliveredCount ?? 0;
  const deliveryRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0;

  return {
    totalOrders,
    totalRevenue: orderStats?.totalRevenue ?? 0,
    deliveredCount,
    deliveryRate,
    upsellCount: upsellStats?.upsellCount ?? 0,
  };
}

/**
 * Media-buyer commission input: this buyer's OWN attributed orders
 * (numbatrak_ad_spend.orders, summed across every brand they bought ads for
 * this month), not a shared team total - keying off each buyer's own
 * ad_spend rows (already partitioned per buyerId) means two buyers on the
 * same brand each get paid off their own numbers, never a shared/double-
 * counted total. No delivery-rate concept applies to media buyers, so
 * deliveryRate is fixed at 100 - it never lets a commission gate (if one's
 * enabled on the Media pay structure) zero this out.
 */
async function getMediaBuyerOrderData(
  db: Queryable,
  organizationId: string,
  userId: string,
  month: string,
): Promise<Awaited<ReturnType<typeof getStaffOrderData>>> {
  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endMonth = new Date(startDate);
  endMonth.setMonth(endMonth.getMonth() + 1);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endMonthStr = endMonth.toISOString().slice(0, 10);

  const [spendStats] = await db
    .select({
      totalOrders: sql<number>`coalesce(sum(${numbatrakAdSpend.orders}), 0)::int`,
    })
    .from(numbatrakAdSpend)
    .where(
      and(
        eq(numbatrakAdSpend.organizationId, organizationId),
        eq(numbatrakAdSpend.buyerId, userId),
        sql`${numbatrakAdSpend.spendDate} >= ${startDateStr}`,
        sql`${numbatrakAdSpend.spendDate} < ${endMonthStr}`,
      ),
    );

  const totalOrders = spendStats?.totalOrders ?? 0;
  return {
    totalOrders,
    totalRevenue: 0,
    deliveredCount: totalOrders,
    deliveryRate: 100,
    upsellCount: 0,
  };
}

/**
 * Team hit-KPI rate for the manager gate: active CRS-primary-role staff who
 * report to this manager (numbatrakStaff.managerId - the real reporting
 * hierarchy, already used org-wide by Staff's "managers see their team"
 * rule), each person's own delivery rate for the month. Scoped per manager,
 * not org-wide, so a manager's bonus depends only on the team actually
 * assigned to them.
 */
async function getTeamDeliveryRates(
  db: Queryable,
  organizationId: string,
  month: string,
  managerStaffId: string,
): Promise<number[]> {
  const reportIds = await getDirectReportStaffIds(db, organizationId, managerStaffId);
  if (reportIds.length === 0) return [];

  const crsStaff = await db
    .select()
    .from(numbatrakStaff)
    .where(
      and(
        eq(numbatrakStaff.organizationId, organizationId),
        eq(numbatrakStaff.active, true),
        eq(numbatrakStaff.primaryRole, "CRS"),
        inArray(numbatrakStaff.id, reportIds),
      ),
    );

  const rates: number[] = [];
  for (const staff of crsStaff) {
    const data = await getStaffOrderData(db, organizationId, staff.userId, month);
    rates.push(data.deliveryRate);
  }
  return rates;
}

function calculatePay(
  ps: typeof numbatrakPayStructures.$inferSelect,
  orderData: Awaited<ReturnType<typeof getStaffOrderData>>,
  teamDeliveryRates: number[],
) {
  const baseSalary = ps.baseSalaryEnabled ? Number(ps.baseSalaryAmount) : 0;

  let commission = 0;
  let commissionGateMissed = false;
  if (ps.commissionEnabled) {
    if (ps.commissionGateEnabled && orderData.deliveryRate < Number(ps.commissionGateThresholdPercent)) {
      commissionGateMissed = true;
    } else {
      if (ps.commissionBasis === "flat_per_order") {
        commission = orderData.totalOrders * Number(ps.commissionRate);
      } else {
        commission = orderData.totalRevenue * (Number(ps.commissionRate) / 100);
      }
    }
  }

  const upsellBonus = ps.upsellBonusEnabled ? orderData.upsellCount * Number(ps.upsellBonusAmount) : 0;

  let managerBonus = 0;
  let managerGateMissed: boolean | null = null;
  if (ps.managerBonusEnabled) {
    if (ps.managerGateEnabled) {
      const kpiThreshold = Number(ps.managerGateKpiThresholdPercent);
      // No team to measure against - nothing to fail the gate on, so it pays.
      const teamRatio =
        teamDeliveryRates.length === 0
          ? 100
          : (teamDeliveryRates.filter((rate) => rate >= kpiThreshold).length / teamDeliveryRates.length) * 100;
      managerGateMissed = teamRatio < Number(ps.managerGateTeamRatioPercent);
    }
    managerBonus = managerGateMissed ? 0 : Number(ps.managerBonusAmount);
  }

  return {
    calculatedBaseSalary: String(baseSalary),
    calculatedCommission: String(commission),
    calculatedUpsellBonus: String(upsellBonus),
    calculatedManagerBonus: String(managerBonus),
    deliveryRatePercent: String(orderData.deliveryRate.toFixed(2)),
    commissionGateMissed,
    upsellCount: orderData.upsellCount,
    managerGateMissed,
  };
}

export async function overrideLine(
  db: Database,
  organizationId: string,
  lineId: string,
  input: { overrideBaseSalary?: number | null; overrideCommission?: number | null },
): Promise<PayrollLineRow | null> {
  await assertLineMutable(db, organizationId, lineId);
  const values: Partial<typeof numbatrakPayrollLines.$inferInsert> = { updatedAt: new Date() };
  if (input.overrideBaseSalary !== undefined) {
    values.overrideBaseSalary = input.overrideBaseSalary != null ? String(input.overrideBaseSalary) : null;
  }
  if (input.overrideCommission !== undefined) {
    values.overrideCommission = input.overrideCommission != null ? String(input.overrideCommission) : null;
  }
  const [row] = await db.update(numbatrakPayrollLines).set(values).where(eq(numbatrakPayrollLines.id, lineId)).returning();
  return row ?? null;
}

export async function setManualAdjustment(
  db: Database,
  organizationId: string,
  lineId: string,
  input: { manualAdjustment: number; manualAdjustmentNote?: string | null },
): Promise<PayrollLineRow | null> {
  await assertLineMutable(db, organizationId, lineId);
  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({
      manualAdjustment: String(input.manualAdjustment),
      manualAdjustmentNote: input.manualAdjustmentNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  return row ?? null;
}

/**
 * `overrideAmount` lets the Stars module's confirm-SOTM flow pass its own
 * configured `sotmPrizeAmount` directly, instead of falling back to the pay
 * structure's `sotmBonusAmount` - the Stars settings are the source of truth
 * when a winner is actually confirmed there; Payroll's own manual toggle
 * (no override passed) keeps using the pay-structure amount as before.
 */
export async function awardSotm(
  db: Database,
  organizationId: string,
  lineId: string,
  awarded: boolean,
  overrideAmount?: number,
): Promise<PayrollLineRow | null> {
  await assertLineMutable(db, organizationId, lineId);
  const [line] = await db.select().from(numbatrakPayrollLines).where(eq(numbatrakPayrollLines.id, lineId)).limit(1);
  if (!line) return null;

  let sotmBonus = 0;
  if (awarded) {
    if (overrideAmount != null) {
      sotmBonus = overrideAmount;
    } else {
      const [staff] = await db.select().from(numbatrakStaff).where(eq(numbatrakStaff.id, line.staffId)).limit(1);
      if (staff) {
        const structures = await db
          .select()
          .from(numbatrakPayStructures)
          .where(eq(numbatrakPayStructures.organizationId, staff.organizationId));
        const ps =
          structures.find((s) => s.scopeType === "staff" && s.staffId === staff.id) ??
          structures.find((s) => s.scopeType === "role" && s.role === staff.primaryRole);
        if (ps?.sotmBonusEnabled) sotmBonus = Number(ps.sotmBonusAmount);
      }
    }
  }

  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({ sotmAwarded: awarded, calculatedSotmBonus: String(sotmBonus), updatedAt: new Date() })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  return row ?? null;
}

/**
 * `paidAmount` snapshots the line's total pay at the moment of marking, so a
 * later override/adjustment can never retroactively change what was
 * actually recorded as paid - re-marking (after an un-pay) captures a fresh
 * snapshot each time, since it reads the current total at click-time.
 */
export async function markPaid(
  db: Database,
  logger: FastifyBaseLogger,
  organizationId: string,
  lineId: string,
  paid: boolean,
  paidByUserId: string | null,
  paidNotes?: string | null,
): Promise<PayrollLineRow | null> {
  await assertLineMutable(db, organizationId, lineId);

  let paidAmount: string | null = null;
  if (paid) {
    const [line] = await db.select().from(numbatrakPayrollLines).where(eq(numbatrakPayrollLines.id, lineId)).limit(1);
    if (!line) return null;
    const baseSalary = line.overrideBaseSalary != null ? Number(line.overrideBaseSalary) : Number(line.calculatedBaseSalary);
    const commission = line.overrideCommission != null ? Number(line.overrideCommission) : Number(line.calculatedCommission);
    const total =
      baseSalary +
      commission +
      Number(line.calculatedUpsellBonus) +
      Number(line.calculatedSotmBonus) +
      Number(line.calculatedManagerBonus) +
      Number(line.manualAdjustment);
    paidAmount = String(total);
  }

  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({
      paid,
      paidAt: paid ? new Date() : null,
      paidAmount: paid ? paidAmount : null,
      paidBy: paid ? paidByUserId : null,
      paidNotes: paid ? (paidNotes ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  if (!row) return null;

  // Payslip email on mark-paid, per the spec's "notified when marked paid"
  // rule. The in-app bell half of that rule needs the (still-unbuilt)
  // shared Notifications system - email alone covers the "must not be
  // missed" part in the meantime. Never let an email failure undo or fail
  // the mark-paid action itself, since the DB write already succeeded.
  if (paid) {
    try {
      await sendPayslipEmail(db, logger, row);
    } catch (err) {
      logger.warn({ err, lineId }, "Failed to send payslip email");
    }
  }

  return row;
}

async function sendPayslipEmail(db: Database, logger: FastifyBaseLogger, line: PayrollLineRow): Promise<void> {
  const [row] = await db
    .select({ userName: user.name, userEmail: user.email, month: numbatrakPayrollRuns.month })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .innerJoin(numbatrakPayrollRuns, eq(numbatrakPayrollRuns.id, line.runId))
    .where(eq(numbatrakStaff.id, line.staffId))
    .limit(1);
  if (!row) return;

  const baseSalary = line.overrideBaseSalary != null ? Number(line.overrideBaseSalary) : Number(line.calculatedBaseSalary);
  const commission = line.overrideCommission != null ? Number(line.overrideCommission) : Number(line.calculatedCommission);
  const upsellBonus = Number(line.calculatedUpsellBonus);
  const sotmBonus = Number(line.calculatedSotmBonus);
  const managerBonus = Number(line.calculatedManagerBonus);
  const manualAdjustment = Number(line.manualAdjustment);
  const totalPay = baseSalary + commission + upsellBonus + sotmBonus + managerBonus + manualAdjustment;

  await sendEmail(logger, {
    to: row.userEmail,
    subject: `Your ${row.month} payslip is ready`,
    body: payslipEmail({
      staffName: row.userName,
      month: row.month,
      baseSalary,
      commission,
      upsellBonus,
      sotmBonus,
      managerBonus,
      manualAdjustment,
      totalPay,
    }),
  });
}

export async function getMyEarnings(
  db: Database,
  organizationId: string,
  userId: string,
): Promise<NumbatrakMyEarnings | null> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [staffRow] = await db
    .select()
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.userId, userId)))
    .limit(1);
  if (!staffRow) return null;

  const structures = await db
    .select()
    .from(numbatrakPayStructures)
    .where(eq(numbatrakPayStructures.organizationId, organizationId));

  const staffStructure = structures.find((s) => s.scopeType === "staff" && s.staffId === staffRow.id);
  const roleStructure = structures.find((s) => s.scopeType === "role" && s.role === staffRow.primaryRole);
  const ps = staffStructure ?? roleStructure;
  if (!ps) return null;

  const orderData =
    staffRow.primaryRole === "Media"
      ? await getMediaBuyerOrderData(db, organizationId, userId, month)
      : await getStaffOrderData(db, organizationId, userId, month);

  const baseSalary = ps.baseSalaryEnabled ? Number(ps.baseSalaryAmount) : 0;
  let commissionSoFar = 0;
  let commissionGateMissed = false;
  if (ps.commissionEnabled) {
    if (ps.commissionGateEnabled && orderData.deliveryRate < Number(ps.commissionGateThresholdPercent)) {
      commissionGateMissed = true;
    } else {
      commissionSoFar =
        ps.commissionBasis === "flat_per_order"
          ? orderData.totalOrders * Number(ps.commissionRate)
          : orderData.totalRevenue * (Number(ps.commissionRate) / 100);
    }
  }

  const upsellBonusSoFar = ps.upsellBonusEnabled ? orderData.upsellCount * Number(ps.upsellBonusAmount) : 0;
  const onTrackTotal = baseSalary + commissionSoFar + upsellBonusSoFar;

  let gateStatusMessage: string | null = null;
  if (ps.commissionGateEnabled) {
    if (commissionGateMissed) {
      gateStatusMessage = `Delivery rate ${orderData.deliveryRate.toFixed(1)}% is below the ${Number(ps.commissionGateThresholdPercent)}% gate — commission locked.`;
    } else {
      gateStatusMessage = `Delivery rate ${orderData.deliveryRate.toFixed(1)}% clears the ${Number(ps.commissionGateThresholdPercent)}% gate.`;
    }
  }

  return {
    month,
    baseSalary,
    commissionSoFar,
    commissionGateMissed,
    deliveryRatePercent: orderData.deliveryRate,
    commissionGateThresholdPercent: ps.commissionGateEnabled ? Number(ps.commissionGateThresholdPercent) : null,
    upsellCount: orderData.upsellCount,
    upsellBonusSoFar,
    onTrackTotal,
    gateStatusMessage,
  };
}

function formatMoney(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/**
 * The Calculation Trace screen (spec Layer 1): explains every figure on a
 * stored payroll line component by component, built from the line's own
 * recorded values (not a live recompute) so the trace always matches what
 * was actually paid, including after an override or a re-run.
 */
export async function getPayrollLineTrace(db: Database, lineId: string): Promise<NumbatrakPayrollTrace | null> {
  const [row] = await db
    .select({
      line: numbatrakPayrollLines,
      userName: user.name,
      month: numbatrakPayrollRuns.month,
      staffOrgId: numbatrakStaff.organizationId,
      staffPrimaryRole: numbatrakStaff.primaryRole,
    })
    .from(numbatrakPayrollLines)
    .innerJoin(numbatrakPayrollRuns, eq(numbatrakPayrollLines.runId, numbatrakPayrollRuns.id))
    .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(eq(numbatrakPayrollLines.id, lineId))
    .limit(1);
  if (!row) return null;

  const line = row.line;
  const structures = await db
    .select()
    .from(numbatrakPayStructures)
    .where(eq(numbatrakPayStructures.organizationId, row.staffOrgId));
  const ps =
    structures.find((s) => s.scopeType === "staff" && s.staffId === line.staffId) ??
    structures.find((s) => s.scopeType === "role" && s.role === row.staffPrimaryRole);

  const effectiveBase = line.overrideBaseSalary != null ? Number(line.overrideBaseSalary) : Number(line.calculatedBaseSalary);
  const effectiveCommission =
    line.overrideCommission != null ? Number(line.overrideCommission) : Number(line.calculatedCommission);

  const steps: NumbatrakPayrollTraceStep[] = [];

  const baseEnabled = ps?.baseSalaryEnabled ?? Number(line.calculatedBaseSalary) > 0;
  let baseDetail = baseEnabled ? "Fixed monthly base salary. Always safe — no gate ever touches it." : "Base salary is not enabled for this pay structure.";
  if (line.overrideBaseSalary != null) {
    baseDetail += ` Calculated as ${formatMoney(Number(line.calculatedBaseSalary))}, overridden to ${formatMoney(effectiveBase)}.`;
  }
  steps.push({ component: "base_salary", label: "Base salary", enabled: baseEnabled, amount: effectiveBase, detail: baseDetail });

  const isMedia = row.staffPrimaryRole === "Media";
  const commissionEnabled = ps?.commissionEnabled ?? false;
  let commissionDetail: string;
  if (!commissionEnabled) {
    commissionDetail = "Commission is not enabled for this pay structure.";
  } else {
    const basisLabel = ps?.commissionBasis === "percentage_of_sale"
      ? `${Number(ps.commissionRate)}% of delivered sale value`
      : isMedia
        ? `${formatMoney(Number(ps?.commissionRate ?? 0))} per order attributed to this buyer's own ad spend`
        : `${formatMoney(Number(ps?.commissionRate ?? 0))} per delivered order`;
    commissionDetail = `Basis: ${basisLabel}.`;
    if (isMedia) {
      commissionDetail += " No delivery-rate gate applies to media-buyer commission.";
    } else if (ps?.commissionGateEnabled) {
      const rate = line.deliveryRatePercent != null ? Number(line.deliveryRatePercent) : null;
      const threshold = Number(ps.commissionGateThresholdPercent);
      commissionDetail += line.commissionGateMissed
        ? ` Delivery-rate gate: ${rate?.toFixed(1) ?? "?"}% is below the ${threshold}% threshold — the whole month's commission zeroes.`
        : ` Delivery-rate gate: ${rate?.toFixed(1) ?? "?"}% clears the ${threshold}% threshold.`;
    } else {
      commissionDetail += " No delivery-rate gate on this structure — commission is paid straight.";
    }
    if (line.overrideCommission != null) {
      commissionDetail += ` Calculated as ${formatMoney(Number(line.calculatedCommission))}, overridden to ${formatMoney(effectiveCommission)}.`;
    }
  }
  steps.push({ component: "commission", label: "Commission", enabled: commissionEnabled, amount: effectiveCommission, detail: commissionDetail });

  const upsellEnabled = ps?.upsellBonusEnabled ?? line.upsellCount > 0;
  const upsellDetail = upsellEnabled
    ? `${line.upsellCount} upsell(s) × ${formatMoney(Number(ps?.upsellBonusAmount ?? 0))} = ${formatMoney(Number(line.calculatedUpsellBonus))}. Never gated — always earned.`
    : "Upsell bonus is not enabled for this pay structure.";
  steps.push({ component: "upsell_bonus", label: "Upsell bonus", enabled: upsellEnabled, amount: Number(line.calculatedUpsellBonus), detail: upsellDetail });

  const sotmEnabled = ps?.sotmBonusEnabled ?? false;
  const sotmDetail = !sotmEnabled
    ? "Star of the Month bonus is not enabled for this pay structure."
    : line.sotmAwarded
      ? `Awarded Star of the Month this month — ${formatMoney(Number(line.calculatedSotmBonus))}.`
      : "Not awarded Star of the Month this month.";
  steps.push({ component: "sotm_bonus", label: "Star of the Month bonus", enabled: sotmEnabled, amount: Number(line.calculatedSotmBonus), detail: sotmDetail });

  const managerEnabled = ps?.managerBonusEnabled ?? false;
  let managerDetail: string;
  if (!managerEnabled) {
    managerDetail = "Manager bonus is not enabled for this pay structure.";
  } else if (!ps?.managerGateEnabled) {
    managerDetail = "No team-ratio gate on this structure — manager bonus is paid in full.";
  } else if (line.managerGateMissed) {
    managerDetail = `Team-ratio gate missed — fewer than ${Number(ps.managerGateTeamRatioPercent)}% of your direct-report CRS team hit their ${Number(ps.managerGateKpiThresholdPercent)}% KPI threshold this month, so the manager bonus zeroes.`;
  } else {
    managerDetail = `Team-ratio gate cleared — at least ${Number(ps.managerGateTeamRatioPercent)}% of your direct-report CRS team hit their ${Number(ps.managerGateKpiThresholdPercent)}% KPI threshold this month.`;
  }
  steps.push({ component: "manager_bonus", label: "Manager bonus", enabled: managerEnabled, amount: Number(line.calculatedManagerBonus), detail: managerDetail });

  const adjustment = Number(line.manualAdjustment);
  steps.push({
    component: "manual_adjustment",
    label: "Manual adjustment",
    enabled: adjustment !== 0,
    amount: adjustment,
    detail: adjustment !== 0 ? (line.manualAdjustmentNote ?? "No note provided.") : "No manual adjustment this month.",
  });

  const totalPay =
    effectiveBase + effectiveCommission + Number(line.calculatedUpsellBonus) + Number(line.calculatedSotmBonus) + Number(line.calculatedManagerBonus) + adjustment;

  return {
    lineId: line.id,
    staffId: line.staffId,
    staffName: row.userName,
    month: row.month,
    steps,
    totalPay,
    paid: line.paid,
  };
}
