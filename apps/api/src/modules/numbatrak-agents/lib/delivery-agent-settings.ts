import { eq } from "drizzle-orm";
import { numbatrakDeliveryAgentSettings, type Database } from "@platform/db";
import type {
  NumbatrakDeliveryAgentSettings,
  UpdateNumbatrakDeliveryAgentSettingsRequest,
} from "@platform/shared-types";

type Row = typeof numbatrakDeliveryAgentSettings.$inferSelect;

function serialize(row: Row): NumbatrakDeliveryAgentSettings {
  return {
    id: row.id,
    defaultAgentDeliveryFee: Number(row.defaultAgentDeliveryFee),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateDeliveryAgentSettings(
  db: Database,
  organizationId: string,
): Promise<NumbatrakDeliveryAgentSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakDeliveryAgentSettings)
    .where(eq(numbatrakDeliveryAgentSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serialize(existing);

  const [row] = await db.insert(numbatrakDeliveryAgentSettings).values({ organizationId }).returning();
  return serialize(row!);
}

export async function updateDeliveryAgentSettings(
  db: Database,
  organizationId: string,
  input: UpdateNumbatrakDeliveryAgentSettingsRequest,
): Promise<NumbatrakDeliveryAgentSettings> {
  const current = await getOrCreateDeliveryAgentSettings(db, organizationId);
  const values: Partial<typeof numbatrakDeliveryAgentSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.defaultAgentDeliveryFee !== undefined) {
    values.defaultAgentDeliveryFee = String(input.defaultAgentDeliveryFee);
  }

  const [row] = await db
    .update(numbatrakDeliveryAgentSettings)
    .set(values)
    .where(eq(numbatrakDeliveryAgentSettings.id, current.id))
    .returning();
  return serialize(row!);
}
