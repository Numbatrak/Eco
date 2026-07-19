import { featureFlags, type Database } from "@platform/db";
import type { FeatureFlag } from "@platform/shared-types";

function serialize(row: typeof featureFlags.$inferSelect): FeatureFlag {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFeatureFlags(db: Database): Promise<FeatureFlag[]> {
  const rows = await db.select().from(featureFlags).orderBy(featureFlags.key);
  return rows.map(serialize);
}

export async function upsertFeatureFlag(
  db: Database,
  params: { key: string; enabled: boolean; description?: string },
): Promise<FeatureFlag> {
  const [row] = await db
    .insert(featureFlags)
    .values({ key: params.key, enabled: params.enabled, description: params.description, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { enabled: params.enabled, description: params.description, updatedAt: new Date() },
    })
    .returning();
  if (!row) {
    throw new Error("Failed to upsert feature flag");
  }
  return serialize(row);
}
