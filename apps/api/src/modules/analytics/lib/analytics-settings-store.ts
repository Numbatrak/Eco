import { eq } from "drizzle-orm";
import { tenantAnalyticsSettings, type Database } from "@platform/db";
import type { AnalyticsSettingsRequest, AnalyticsSettingsResponse } from "@platform/shared-types";
import { encryptSecret } from "../../../lib/encryption.js";

export type AnalyticsSettingsRow = typeof tenantAnalyticsSettings.$inferSelect;

export async function findAnalyticsSettings(
  db: Database,
  tenantId: string,
): Promise<AnalyticsSettingsRow | null> {
  const [row] = await db
    .select()
    .from(tenantAnalyticsSettings)
    .where(eq(tenantAnalyticsSettings.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

/** Never includes the decrypted CAPI token - only whether one is configured. */
export function serializeAnalyticsSettings(row: AnalyticsSettingsRow | null): AnalyticsSettingsResponse {
  if (!row) {
    return { metaPixelId: null, hasCapiToken: false, enabled: false };
  }
  return {
    metaPixelId: row.metaPixelId,
    hasCapiToken: Boolean(row.metaCapiTokenEncrypted),
    enabled: row.enabled,
  };
}

export async function upsertAnalyticsSettings(
  db: Database,
  tenantId: string,
  input: AnalyticsSettingsRequest,
): Promise<void> {
  const metaCapiTokenEncrypted = encryptSecret(input.metaCapiToken);
  await db
    .insert(tenantAnalyticsSettings)
    .values({
      tenantId,
      metaPixelId: input.metaPixelId,
      metaCapiTokenEncrypted,
      enabled: input.enabled,
    })
    .onConflictDoUpdate({
      target: tenantAnalyticsSettings.tenantId,
      set: {
        metaPixelId: input.metaPixelId,
        metaCapiTokenEncrypted,
        enabled: input.enabled,
        updatedAt: new Date(),
      },
    });
}
