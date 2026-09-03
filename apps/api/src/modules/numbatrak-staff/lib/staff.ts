import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  member,
  numbatrakStaff,
  numbatrakStaffSubBrands,
  user,
  type Database,
  type Queryable,
} from "@platform/db";
import {
  NUMBATRAK_SPEC_ROLE_COMPATIBLE_MEMBER_ROLES,
  type CreateNumbatrakStaffRequest,
  type NumbatrakEligibleMember,
  type NumbatrakStaff,
  type UpdateNumbatrakStaffRequest,
} from "@platform/shared-types";

export type StaffRow = typeof numbatrakStaff.$inferSelect;

/**
 * Row-level visibility computed by the route from the caller's own
 * membership - `staffIds` is always the full whitelist of visible staff
 * records (the caller's own id, plus direct reports' ids if they manage
 * anyone), never just "own" alone, so the manager-vs-plain-staff cases share
 * one shape.
 */
export type StaffListScope = { all: true } | { all: false; staffIds: string[] };

async function getSubBrands(db: Queryable, staffId: string): Promise<string[]> {
  const rows = await db
    .select({ subBrand: numbatrakStaffSubBrands.subBrand })
    .from(numbatrakStaffSubBrands)
    .where(eq(numbatrakStaffSubBrands.staffId, staffId));
  return rows.map((r) => r.subBrand);
}

async function replaceSubBrands(db: Queryable, staffId: string, subBrands: string[]): Promise<void> {
  await db.delete(numbatrakStaffSubBrands).where(eq(numbatrakStaffSubBrands.staffId, staffId));
  if (subBrands.length > 0) {
    await db.insert(numbatrakStaffSubBrands).values(subBrands.map((subBrand) => ({ staffId, subBrand })));
  }
}

function serializeStaff(
  row: StaffRow,
  userInfo: { name: string; email: string } | null,
  memberRole: string | null,
  subBrands: string[],
  managerName: string | null,
): NumbatrakStaff {
  return {
    id: row.id,
    userId: row.userId,
    userName: userInfo?.name ?? null,
    userEmail: userInfo?.email ?? null,
    memberRole,
    primaryRole: row.primaryRole as NumbatrakStaff["primaryRole"],
    extraRoles: row.extraRoles as NumbatrakStaff["extraRoles"],
    subBrands,
    phone: row.phone,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumber,
    bankAccountName: row.bankAccountName,
    active: row.active,
    managerId: row.managerId,
    managerName,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

const managerStaff = alias(numbatrakStaff, "manager_staff");
const managerUser = alias(user, "manager_user");

/** Every staff id this manager's staff record can reach as a direct report - one level, no transitive chains. */
export async function getDirectReportStaffIds(db: Queryable, organizationId: string, managerStaffId: string): Promise<string[]> {
  const rows = await db
    .select({ id: numbatrakStaff.id })
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.managerId, managerStaffId)));
  return rows.map((r) => r.id);
}

const BROAD_VISIBILITY_ROLES = new Set(["owner", "admin"]);

export type CallerStaffScope =
  | { all: true; memberRole: string }
  | { all: false; memberRole: string | null; ownStaffId: string | null; staffIds: string[] };

/**
 * Shared "who can this caller see/act on" resolution for Staff/Strikes/Leave
 * (and anywhere else the spec's "admin all, manager team, self own" rule
 * applies) - one source of truth for the reporting-hierarchy lookup so the
 * three modules can't drift out of sync on how "team" is computed.
 */
export async function resolveCallerStaffScope(db: Queryable, organizationId: string, userId: string): Promise<CallerStaffScope> {
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);

  if (membership && BROAD_VISIBILITY_ROLES.has(membership.role)) {
    return { all: true, memberRole: membership.role };
  }

  const [ownStaff] = await db
    .select({ id: numbatrakStaff.id })
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.userId, userId)))
    .limit(1);

  if (ownStaff && membership?.role === "manager") {
    const reports = await getDirectReportStaffIds(db, organizationId, ownStaff.id);
    return { all: false, memberRole: membership.role, ownStaffId: ownStaff.id, staffIds: [ownStaff.id, ...reports] };
  }

  return {
    all: false,
    memberRole: membership?.role ?? null,
    ownStaffId: ownStaff?.id ?? null,
    staffIds: ownStaff ? [ownStaff.id] : [],
  };
}

export async function listStaffForOrg(
  db: Database,
  organizationId: string,
  scope: StaffListScope,
): Promise<NumbatrakStaff[]> {
  const conditions = [eq(numbatrakStaff.organizationId, organizationId)];
  if (!scope.all) conditions.push(inArray(numbatrakStaff.id, scope.staffIds));

  const rows = await db
    .select({
      staff: numbatrakStaff,
      userName: user.name,
      userEmail: user.email,
      memberRole: member.role,
      managerName: managerUser.name,
    })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .leftJoin(member, and(eq(member.organizationId, organizationId), eq(member.userId, numbatrakStaff.userId)))
    .leftJoin(managerStaff, eq(numbatrakStaff.managerId, managerStaff.id))
    .leftJoin(managerUser, eq(managerStaff.userId, managerUser.id))
    .where(and(...conditions));

  const result: NumbatrakStaff[] = [];
  for (const row of rows) {
    const subBrands = await getSubBrands(db, row.staff.id);
    result.push(
      serializeStaff(row.staff, { name: row.userName, email: row.userEmail }, row.memberRole ?? null, subBrands, row.managerName ?? null),
    );
  }
  return result;
}

export async function listEligibleMembers(db: Database, organizationId: string): Promise<NumbatrakEligibleMember[]> {
  const rows = await db
    .select({
      userId: member.userId,
      name: user.name,
      email: user.email,
      memberRole: member.role,
      staffId: numbatrakStaff.id,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .leftJoin(
      numbatrakStaff,
      and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.userId, member.userId)),
    )
    .where(eq(member.organizationId, organizationId));

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    memberRole: row.memberRole,
    hasStaffRecord: row.staffId != null,
  }));
}

function assertRoleCompatible(primaryRole: string, memberRole: string): void {
  const compatible = NUMBATRAK_SPEC_ROLE_COMPATIBLE_MEMBER_ROLES[primaryRole as keyof typeof NUMBATRAK_SPEC_ROLE_COMPATIBLE_MEMBER_ROLES];
  if (!compatible?.includes(memberRole)) {
    throw new Error(
      `primaryRole "${primaryRole}" isn't compatible with this member's actual role ("${memberRole}").`,
    );
  }
}

export async function createStaff(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakStaffRequest,
): Promise<NumbatrakStaff> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, input.userId)))
      .limit(1);
    if (!membership) throw new Error("This user isn't a member of the organization.");
    assertRoleCompatible(input.primaryRole, membership.role);

    const managerId = await resolveManagerId(tx, organizationId, input.managerId, null);

    const [row] = await tx
      .insert(numbatrakStaff)
      .values({
        organizationId,
        userId: input.userId,
        primaryRole: input.primaryRole,
        extraRoles: input.extraRoles ?? [],
        phone: input.phone ?? null,
        bankName: input.bankName ?? null,
        bankAccountNumber: input.bankAccountNumber ?? null,
        bankAccountName: input.bankAccountName ?? null,
        managerId,
      })
      .returning();
    if (!row) throw new Error("Failed to create staff record");

    await replaceSubBrands(tx, row.id, input.subBrands ?? []);

    const [userInfo] = await tx.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, input.userId)).limit(1);
    const managerName = await getManagerName(tx, managerId);
    return serializeStaff(row, userInfo ?? null, membership.role, input.subBrands ?? [], managerName);
  });
}

/** Validates a proposed managerId (if any) belongs to the org and isn't the staff record itself. */
async function resolveManagerId(
  db: Queryable,
  organizationId: string,
  managerId: string | null | undefined,
  selfStaffId: string | null,
): Promise<string | null> {
  if (managerId === undefined) return null;
  if (managerId === null) return null;
  if (managerId === selfStaffId) throw new Error("A staff member can't be their own manager.");

  const [manager] = await db
    .select({ id: numbatrakStaff.id })
    .from(numbatrakStaff)
    .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.id, managerId)))
    .limit(1);
  if (!manager) throw new Error("Manager must be an existing staff member in this organization.");
  return managerId;
}

async function getManagerName(db: Queryable, managerId: string | null): Promise<string | null> {
  if (!managerId) return null;
  const [row] = await db
    .select({ name: user.name })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(eq(numbatrakStaff.id, managerId))
    .limit(1);
  return row?.name ?? null;
}

export async function updateStaff(
  db: Database,
  organizationId: string,
  staffId: string,
  input: UpdateNumbatrakStaffRequest,
): Promise<NumbatrakStaff | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(numbatrakStaff)
      .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.id, staffId)))
      .limit(1);
    if (!existing) return null;

    if (input.primaryRole !== undefined) {
      const [membership] = await tx
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, existing.userId)))
        .limit(1);
      if (!membership) throw new Error("This user is no longer a member of the organization.");
      assertRoleCompatible(input.primaryRole, membership.role);
    }

    const values: Partial<typeof numbatrakStaff.$inferInsert> = { updatedAt: new Date() };
    if (input.primaryRole !== undefined) values.primaryRole = input.primaryRole;
    if (input.extraRoles !== undefined) values.extraRoles = input.extraRoles;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.bankName !== undefined) values.bankName = input.bankName;
    if (input.bankAccountNumber !== undefined) values.bankAccountNumber = input.bankAccountNumber;
    if (input.bankAccountName !== undefined) values.bankAccountName = input.bankAccountName;
    if (input.active !== undefined) values.active = input.active;
    if (input.managerId !== undefined) {
      values.managerId = await resolveManagerId(tx, organizationId, input.managerId, staffId);
    }

    const [row] = await tx
      .update(numbatrakStaff)
      .set(values)
      .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.id, staffId)))
      .returning();
    if (!row) throw new Error("Failed to update staff record");

    if (input.subBrands !== undefined) {
      await replaceSubBrands(tx, staffId, input.subBrands);
    }

    const [membership] = await tx
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, row.userId)))
      .limit(1);
    const [userInfo] = await tx.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, row.userId)).limit(1);
    const subBrands = await getSubBrands(tx, staffId);
    const managerName = await getManagerName(tx, row.managerId);
    return serializeStaff(row, userInfo ?? null, membership?.role ?? null, subBrands, managerName);
  });
}
