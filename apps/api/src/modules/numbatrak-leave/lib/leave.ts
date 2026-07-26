import { and, eq, desc } from "drizzle-orm";
import {
  numbatrakLeaveSettings,
  numbatrakLeaveBalances,
  numbatrakLeaveRequests,
  numbatrakStaff,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakLeaveSettings,
  NumbatrakLeaveBalance,
  NumbatrakLeaveRequest,
  NumbatrakLeaveType,
} from "@platform/shared-types";

type SettingsRow = typeof numbatrakLeaveSettings.$inferSelect;
type RequestRow = typeof numbatrakLeaveRequests.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakLeaveSettings {
  return {
    id: row.id,
    annualDays: row.annualDays,
    sickDays: row.sickDays,
    emergencyDays: row.emergencyDays,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeRequest(row: RequestRow, staffName: string | null, decidedByName: string | null): NumbatrakLeaveRequest {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName,
    leaveType: row.leaveType as NumbatrakLeaveType,
    startDate: row.startDate?.toISOString() ?? "",
    endDate: row.endDate?.toISOString() ?? "",
    days: row.days,
    reason: row.reason,
    status: row.status as NumbatrakLeaveRequest["status"],
    decidedBy: row.decidedBy,
    decidedByName,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakLeaveSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakLeaveSettings)
    .where(eq(numbatrakLeaveSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serializeSettings(existing);

  const [row] = await db
    .insert(numbatrakLeaveSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: { annualDays?: number; sickDays?: number; emergencyDays?: number },
): Promise<NumbatrakLeaveSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakLeaveSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.annualDays !== undefined) values.annualDays = input.annualDays;
  if (input.sickDays !== undefined) values.sickDays = input.sickDays;
  if (input.emergencyDays !== undefined) values.emergencyDays = input.emergencyDays;

  const [row] = await db
    .update(numbatrakLeaveSettings)
    .set(values)
    .where(eq(numbatrakLeaveSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

async function getOrCreateBalance(db: Database, organizationId: string, staffId: string, year: number) {
  const [existing] = await db
    .select()
    .from(numbatrakLeaveBalances)
    .where(
      and(
        eq(numbatrakLeaveBalances.organizationId, organizationId),
        eq(numbatrakLeaveBalances.staffId, staffId),
        eq(numbatrakLeaveBalances.year, year),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(numbatrakLeaveBalances)
    .values({ organizationId, staffId, year })
    .returning();
  return row!;
}

export async function listBalances(
  db: Database,
  organizationId: string,
  year: number,
): Promise<NumbatrakLeaveBalance[]> {
  const settings = await getOrCreateSettings(db, organizationId);
  const staff = await db
    .select({ id: numbatrakStaff.id, userId: numbatrakStaff.userId, active: numbatrakStaff.active })
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.active, true)));

  const result: NumbatrakLeaveBalance[] = [];
  for (const s of staff) {
    const balance = await getOrCreateBalance(db, organizationId, s.id, year);
    const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, s.userId)).limit(1);

    result.push({
      staffId: s.id,
      staffName: u?.name ?? null,
      year,
      annualEntitled: settings.annualDays,
      annualUsed: balance.annualUsed,
      annualRemaining: settings.annualDays - balance.annualUsed,
      sickEntitled: settings.sickDays,
      sickUsed: balance.sickUsed,
      sickRemaining: settings.sickDays - balance.sickUsed,
      emergencyEntitled: settings.emergencyDays,
      emergencyUsed: balance.emergencyUsed,
      emergencyRemaining: settings.emergencyDays - balance.emergencyUsed,
      unpaidUsed: balance.unpaidUsed,
    });
  }
  return result;
}

export async function listRequests(
  db: Database,
  organizationId: string,
  status?: string,
  staffId?: string,
): Promise<NumbatrakLeaveRequest[]> {
  const conditions = [eq(numbatrakLeaveRequests.organizationId, organizationId)];
  if (status) conditions.push(eq(numbatrakLeaveRequests.status, status));
  if (staffId) conditions.push(eq(numbatrakLeaveRequests.staffId, staffId));

  const rows = await db
    .select({
      request: numbatrakLeaveRequests,
      staffName: user.name,
    })
    .from(numbatrakLeaveRequests)
    .innerJoin(numbatrakStaff, eq(numbatrakLeaveRequests.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(numbatrakLeaveRequests.createdAt));

  const result: NumbatrakLeaveRequest[] = [];
  for (const row of rows) {
    let decidedByName: string | null = null;
    if (row.request.decidedBy) {
      const [decider] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.request.decidedBy)).limit(1);
      decidedByName = decider?.name ?? null;
    }
    result.push(serializeRequest(row.request, row.staffName, decidedByName));
  }
  return result;
}

export async function createRequest(
  db: Database,
  organizationId: string,
  staffId: string,
  input: { leaveType: string; startDate: string; endDate: string; days: number; reason?: string | null },
): Promise<NumbatrakLeaveRequest> {
  const [row] = await db
    .insert(numbatrakLeaveRequests)
    .values({
      organizationId,
      staffId,
      leaveType: input.leaveType,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      days: input.days,
      reason: input.reason ?? null,
    })
    .returning();
  return serializeRequest(row!, null, null);
}

export async function decideRequest(
  db: Database,
  organizationId: string,
  requestId: string,
  status: "approved" | "declined",
  decidedBy: string,
  decisionNote?: string | null,
): Promise<NumbatrakLeaveRequest | null> {
  const [existing] = await db
    .select()
    .from(numbatrakLeaveRequests)
    .where(and(eq(numbatrakLeaveRequests.id, requestId), eq(numbatrakLeaveRequests.organizationId, organizationId)))
    .limit(1);

  if (!existing || existing.status !== "pending") return null;

  const [row] = await db
    .update(numbatrakLeaveRequests)
    .set({
      status,
      decidedBy,
      decidedAt: new Date(),
      decisionNote: decisionNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(numbatrakLeaveRequests.id, requestId))
    .returning();

  if (status === "approved" && row) {
    const year = new Date(row.startDate).getFullYear();
    const balance = await getOrCreateBalance(db, organizationId, row.staffId, year);
    const leaveType = row.leaveType as NumbatrakLeaveType;
    const updateValues: Partial<typeof numbatrakLeaveBalances.$inferInsert> = { updatedAt: new Date() };

    if (leaveType === "annual") updateValues.annualUsed = balance.annualUsed + row.days;
    else if (leaveType === "sick") updateValues.sickUsed = balance.sickUsed + row.days;
    else if (leaveType === "emergency") updateValues.emergencyUsed = balance.emergencyUsed + row.days;
    else if (leaveType === "unpaid") updateValues.unpaidUsed = balance.unpaidUsed + row.days;

    await db
      .update(numbatrakLeaveBalances)
      .set(updateValues)
      .where(eq(numbatrakLeaveBalances.id, balance.id));
  }

  return row ? serializeRequest(row, null, null) : null;
}

export async function getStaffIdForUser(db: Database, organizationId: string, userId: string): Promise<string | null> {
  const [staff] = await db
    .select({ id: numbatrakStaff.id })
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.userId, userId)))
    .limit(1);
  return staff?.id ?? null;
}
