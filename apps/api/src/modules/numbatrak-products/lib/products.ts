import { asc, eq } from "drizzle-orm";
import { numbatrakProducts, type Database } from "@platform/db";
import type { NumbatrakProduct } from "@platform/shared-types";

export type NumbatrakProductRow = typeof numbatrakProducts.$inferSelect;

export function serializeNumbatrakProduct(row: NumbatrakProductRow): NumbatrakProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    active: row.active,
    basePrice: row.basePrice,
    costPrice: row.costPrice,
  };
}

export async function listNumbatrakProductsForOrg(
  db: Database,
  organizationId: string,
): Promise<NumbatrakProductRow[]> {
  return db
    .select()
    .from(numbatrakProducts)
    .where(eq(numbatrakProducts.organizationId, organizationId))
    .orderBy(asc(numbatrakProducts.name));
}
