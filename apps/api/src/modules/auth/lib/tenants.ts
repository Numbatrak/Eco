import { tenants, tenantMembers, tenantSiteConfig, type Database } from "@platform/db";
import { grantPermissionsForRole } from "../../permissions/lib/grants.js";

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
