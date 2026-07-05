import { eq } from "drizzle-orm";
import { tenants, tenantMembers, tenantSiteConfig, type Database } from "@platform/db";
import { grantPermissionsForRole } from "../../permissions/lib/grants.js";
import type { TenantMemberRole } from "../../permissions/lib/permissions.js";

export interface CreateTenantWithOwnerParams {
  name: string;
  ownerUserId: string;
}

export interface CreatedTenant {
  id: string;
  name: string;
}

export async function createTenantWithOwner(
  db: Database,
  params: CreateTenantWithOwnerParams,
): Promise<CreatedTenant> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: params.name })
      .returning({ id: tenants.id, name: tenants.name });
    if (!tenant) {
      throw new Error("Failed to create tenant");
    }
    const [member] = await tx
      .insert(tenantMembers)
      .values({
        tenantId: tenant.id,
        userId: params.ownerUserId,
        role: "owner",
      })
      .returning({ id: tenantMembers.id });
    if (!member) {
      throw new Error("Failed to create tenant member");
    }
    await grantPermissionsForRole(tx, member.id, "owner");
    await tx.insert(tenantSiteConfig).values({ tenantId: tenant.id });
    return tenant;
  });
}

export interface UserTenantMembership {
  id: string;
  name: string;
  subdomain: string | null;
  role: TenantMemberRole;
}

/**
 * Tenant-switching UI is out of scope, but a user could in principle belong
 * to more than one tenant (e.g. seeded data, future invite flow) - this
 * returns all memberships rather than assuming exactly one.
 */
export async function listTenantsForUser(
  db: Database,
  userId: string,
): Promise<UserTenantMembership[]> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(eq(tenantMembers.userId, userId));
  return rows;
}
