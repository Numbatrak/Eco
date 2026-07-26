import { and, eq } from "drizzle-orm";
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

/** Row-level visibility computed by the route from the caller's own membership. */
export type StaffListScope = { all: true } | { all: false; ownUserId: string };

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
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function listStaffForOrg(
  db: Database,
  organizationId: string,
  scope: StaffListScope,
): Promise<NumbatrakStaff[]> {
  const conditions = [eq(numbatrakStaff.organizationId, organizationId)];
  if (!scope.all) conditions.push(eq(numbatrakStaff.userId, scope.ownUserId));

  const rows = await db
    .select({
      staff: numbatrakStaff,
      userName: user.name,
      userEmail: user.email,
      memberRole: member.role,
    })
    .from(numbatrakStaff)
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .leftJoin(member, and(eq(member.organizationId, organizationId), eq(member.userId, numbatrakStaff.userId)))
    .where(and(...conditions));

  const result: NumbatrakStaff[] = [];
  for (const row of rows) {
    const subBrands = await getSubBrands(db, row.staff.id);
    result.push(serializeStaff(row.staff, { name: row.userName, email: row.userEmail }, row.memberRole ?? null, subBrands));
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
      })
      .returning();
    if (!row) throw new Error("Failed to create staff record");

    await replaceSubBrands(tx, row.id, input.subBrands ?? []);

    const [userInfo] = await tx.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, input.userId)).limit(1);
    return serializeStaff(row, userInfo ?? null, membership.role, input.subBrands ?? []);
  });
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
    return serializeStaff(row, userInfo ?? null, membership?.role ?? null, subBrands);
  });
}
