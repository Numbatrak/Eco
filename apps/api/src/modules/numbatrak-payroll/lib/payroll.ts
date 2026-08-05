import { and, eq, sql } from "drizzle-orm";
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
} from "@platform/shared-types";

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

export async function listPayStructures(db: Database, organizationId: string): Promise<NumbatrakPayStructure[]> {
  const rows = await db
    .select()
    .from(numbatrakPayStructures)
    .where(eq(numbatrakPayStructures.organizationId, organizationId));
  return rows.map((row) => serializePayStructure(row));
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
): Promise<NumbatrakPayrollRun | null> {
  const [run] = await db
    .select()
    .from(numbatrakPayrollRuns)
    .where(and(eq(numbatrakPayrollRuns.organizationId, organizationId), eq(numbatrakPayrollRuns.month, month)))
    .limit(1);
  if (!run) return null;

  const lineRows = await db
    .select({ line: numbatrakPayrollLines, userName: user.name, primaryRole: numbatrakStaff.primaryRole })
    .from(numbatrakPayrollLines)
    .innerJoin(numbatrakStaff, eq(numbatrakPayrollLines.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(eq(numbatrakPayrollLines.runId, run.id));

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

    for (const staff of activeStaff) {
      const ps = staffStructures.get(staff.id) ?? roleStructures.get(staff.primaryRole);
      if (!ps) continue;

      const orderData = await getStaffOrderData(tx, organizationId, staff.userId, month);
      const calculated = calculatePay(ps, orderData);

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

function calculatePay(
  ps: typeof numbatrakPayStructures.$inferSelect,
  orderData: Awaited<ReturnType<typeof getStaffOrderData>>,
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
  const managerBonus = ps.managerBonusEnabled ? Number(ps.managerBonusAmount) : 0;

  return {
    calculatedBaseSalary: String(baseSalary),
    calculatedCommission: String(commission),
    calculatedUpsellBonus: String(upsellBonus),
    calculatedSotmBonus: "0",
    calculatedManagerBonus: String(managerBonus),
    deliveryRatePercent: String(orderData.deliveryRate.toFixed(2)),
    commissionGateMissed,
    upsellCount: orderData.upsellCount,
    managerGateMissed: null as boolean | null,
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
  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({ sotmAwarded: awarded, updatedAt: new Date() })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  return row ?? null;
}

export async function markPaid(db: Database, lineId: string, paid: boolean): Promise<PayrollLineRow | null> {
  const [row] = await db
    .update(numbatrakPayrollLines)
    .set({ paid, paidAt: paid ? new Date() : null, updatedAt: new Date() })
    .where(eq(numbatrakPayrollLines.id, lineId))
    .returning();
  return row ?? null;
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
