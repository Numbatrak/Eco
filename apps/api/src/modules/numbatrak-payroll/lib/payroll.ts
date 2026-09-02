import { and, eq, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import {
  numbatrakPayStructures,
  numbatrakPayrollRuns,
  numbatrakPayrollLines,
  numbatrakStaff,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  user,
  type Database,
  type Queryable,
} from "@platform/db";
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

function serializeLine(row: PayrollLineRow, staffName: string | null, primaryRole: string | null, runId: string): NumbatrakPayrollLine {
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
    .select({ line: numbatrakPayrollLines, userName: user.name, primaryRole: numbatrakStaff.primaryRole })
    .from(numbatrakPayrollLines)
    .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(...runConditions));

  return {
    id: run.id,
    month: run.month,
    lines: lineRows.map((r) => serializeLine(r.line, r.userName, r.primaryRole, run.id)),
    createdAt: run.createdAt?.toISOString() ?? null,
    updatedAt: run.updatedAt?.toISOString() ?? null,
  };
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
    const teamDeliveryRates = await getTeamDeliveryRates(tx, organizationId, month);

    for (const staff of activeStaff) {
      const ps = staffStructures.get(staff.id) ?? roleStructures.get(staff.primaryRole);
      if (!ps) continue;

      const orderData = await getStaffOrderData(tx, organizationId, staff.userId, month);
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
      .select({ line: numbatrakPayrollLines, userName: user.name, primaryRole: numbatrakStaff.primaryRole })
      .from(numbatrakPayrollLines)
      .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
      .innerJoin(user, eq(numbatrakStaff.userId, user.id))
      .where(eq(numbatrakPayrollLines.runId, run!.id));

    return {
      id: run!.id,
      month: run!.month,
      lines: lineRows.map((r) => serializeLine(r.line, r.userName, r.primaryRole, run!.id)),
      createdAt: run!.createdAt?.toISOString() ?? null,
      updatedAt: run!.updatedAt?.toISOString() ?? null,
    };
  });
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
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDate}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonth}`,
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
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDate}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonth}`,
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
        sql`${numbatrakCustomerOrders.createdAt} >= ${startDate}`,
        sql`${numbatrakCustomerOrders.createdAt} < ${endMonth}`,
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
 * Team hit-KPI rate for the manager gate: every active CRS-primary-role
 * staff org-wide (no reporting hierarchy exists in this schema - see
 * payroll.ts schema comment), each person's own delivery rate for the
 * month. Computed once per run and reused across every manager's gate
 * check, since "team" is the same set of people regardless of which
 * manager is being paid - only the KPI threshold to compare against varies
 * per manager's own pay structure.
 */
async function getTeamDeliveryRates(db: Queryable, organizationId: string, month: string): Promise<number[]> {
  const crsStaff = await db
    .select()
    .from(numbatrakStaff)
    .where(
      and(
        eq(numbatrakStaff.organizationId, organizationId),
        eq(numbatrakStaff.active, true),
        eq(numbatrakStaff.primaryRole, "CRS"),
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
  lineId: string,
  input: { overrideBaseSalary?: number | null; overrideCommission?: number | null },
): Promise<PayrollLineRow | null> {
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
  lineId: string,
  input: { manualAdjustment: number; manualAdjustmentNote?: string | null },
): Promise<PayrollLineRow | null> {
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

export async function awardSotm(db: Database, lineId: string, awarded: boolean): Promise<PayrollLineRow | null> {
  const [line] = await db.select().from(numbatrakPayrollLines).where(eq(numbatrakPayrollLines.id, lineId)).limit(1);
  if (!line) return null;

  let sotmBonus = 0;
  if (awarded) {
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

  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({ sotmAwarded: awarded, calculatedSotmBonus: String(sotmBonus), updatedAt: new Date() })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  return row ?? null;
}

export async function markPaid(
  db: Database,
  logger: FastifyBaseLogger,
  lineId: string,
  paid: boolean,
): Promise<PayrollLineRow | null> {
  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({ paid, paidAt: paid ? new Date() : null, updatedAt: new Date() })
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

  const orderData = await getStaffOrderData(db, organizationId, userId, month);

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

  const commissionEnabled = ps?.commissionEnabled ?? false;
  let commissionDetail: string;
  if (!commissionEnabled) {
    commissionDetail = "Commission is not enabled for this pay structure.";
  } else {
    const basisLabel = ps?.commissionBasis === "percentage_of_sale" ? `${Number(ps.commissionRate)}% of delivered sale value` : `${formatMoney(Number(ps?.commissionRate ?? 0))} per delivered order`;
    commissionDetail = `Basis: ${basisLabel}.`;
    if (ps?.commissionGateEnabled) {
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
    managerDetail = `Team-ratio gate missed — fewer than ${Number(ps.managerGateTeamRatioPercent)}% of the team hit their ${Number(ps.managerGateKpiThresholdPercent)}% KPI threshold this month, so the manager bonus zeroes.`;
  } else {
    managerDetail = `Team-ratio gate cleared — at least ${Number(ps.managerGateTeamRatioPercent)}% of the team hit their ${Number(ps.managerGateKpiThresholdPercent)}% KPI threshold this month.`;
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
