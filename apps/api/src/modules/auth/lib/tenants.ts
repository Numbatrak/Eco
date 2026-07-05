import { tenants, tenantMembers, type Database } from "@platform/db";

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
    await tx.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: params.ownerUserId,
      role: "owner",
    });
    return tenant;
  });
}
