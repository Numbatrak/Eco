import { eq } from "drizzle-orm";
import { numbatrakNotificationSettings, type Database } from "@platform/db";
import type {
  NumbatrakNotificationSettings,
  UpdateNumbatrakNotificationSettingsRequest,
} from "@platform/shared-types";

type Row = typeof numbatrakNotificationSettings.$inferSelect;

function serialize(row: Row): NumbatrakNotificationSettings {
  return {
    id: row.id,
    dailySummaryEnabled: row.dailySummaryEnabled,
    additionalRecipients: row.additionalRecipients,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateNotificationSettings(
  db: Database,
  organizationId: string,
): Promise<NumbatrakNotificationSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakNotificationSettings)
    .where(eq(numbatrakNotificationSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serialize(existing);

  const [row] = await db
    .insert(numbatrakNotificationSettings)
    .values({ organizationId })
    .returning();
  return serialize(row!);
}

export async function updateNotificationSettings(
  db: Database,
  organizationId: string,
  input: UpdateNumbatrakNotificationSettingsRequest,
): Promise<NumbatrakNotificationSettings> {
  const current = await getOrCreateNotificationSettings(db, organizationId);
  const values: Partial<typeof numbatrakNotificationSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.dailySummaryEnabled !== undefined) {
    values.dailySummaryEnabled = input.dailySummaryEnabled;
  }
  if (input.additionalRecipients !== undefined) {
    values.additionalRecipients = input.additionalRecipients;
  }

  const [row] = await db
    .update(numbatrakNotificationSettings)
    .set(values)
    .where(eq(numbatrakNotificationSettings.id, current.id))
    .returning();
  return serialize(row!);
}
