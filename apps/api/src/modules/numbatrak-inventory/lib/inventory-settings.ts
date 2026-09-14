import { eq } from "drizzle-orm";
import { numbatrakInventorySettings, type Database } from "@platform/db";
import type { NumbatrakInventorySettings, UpdateNumbatrakInventorySettingsRequest } from "@platform/shared-types";

type Row = typeof numbatrakInventorySettings.$inferSelect;

function serialize(row: Row): NumbatrakInventorySettings {
  return {
    id: row.id,
    defaultLowStockThreshold: row.defaultLowStockThreshold,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateInventorySettings(
  db: Database,
  organizationId: string,
): Promise<NumbatrakInventorySettings> {
  const [existing] = await db
    .select()
    .from(numbatrakInventorySettings)
    .where(eq(numbatrakInventorySettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serialize(existing);

  const [row] = await db.insert(numbatrakInventorySettings).values({ organizationId }).returning();
  return serialize(row!);
}

export async function updateInventorySettings(
  db: Database,
  organizationId: string,
  input: UpdateNumbatrakInventorySettingsRequest,
): Promise<NumbatrakInventorySettings> {
  const current = await getOrCreateInventorySettings(db, organizationId);
  const values: Partial<typeof numbatrakInventorySettings.$inferInsert> = { updatedAt: new Date() };
  if (input.defaultLowStockThreshold !== undefined) {
    values.defaultLowStockThreshold = input.defaultLowStockThreshold;
  }

  const [row] = await db
    .update(numbatrakInventorySettings)
    .set(values)
    .where(eq(numbatrakInventorySettings.id, current.id))
    .returning();
  return serialize(row!);
}
