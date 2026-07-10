import { platformSettings, type Database } from "@platform/db";
import type { PlatformSetting } from "@platform/shared-types";

function serialize(row: typeof platformSettings.$inferSelect): PlatformSetting {
  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlatformSettings(db: Database): Promise<PlatformSetting[]> {
  const rows = await db.select().from(platformSettings).orderBy(platformSettings.key);
  return rows.map(serialize);
}

export async function upsertPlatformSetting(
  db: Database,
  params: { key: string; value: string },
): Promise<PlatformSetting> {
  const [row] = await db
    .insert(platformSettings)
    .values({ key: params.key, value: params.value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: params.value, updatedAt: new Date() },
    })
    .returning();
  if (!row) {
    throw new Error("Failed to upsert platform setting");
  }
  return serialize(row);
}
