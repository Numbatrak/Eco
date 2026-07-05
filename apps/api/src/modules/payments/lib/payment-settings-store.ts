import { eq } from "drizzle-orm";
import { tenantPaymentSettings, type Database } from "@platform/db";
import type { PaymentSettingsRequest, PaymentSettingsResponse } from "@platform/shared-types";
import { encryptSecret } from "../../../lib/encryption.js";

export type PaymentSettingsRow = typeof tenantPaymentSettings.$inferSelect;

export async function findPaymentSettings(
  db: Database,
  tenantId: string,
): Promise<PaymentSettingsRow | null> {
  const [row] = await db
    .select()
    .from(tenantPaymentSettings)
    .where(eq(tenantPaymentSettings.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

/** Never includes the decrypted secret key - only whether one is configured. */
export function serializePaymentSettings(row: PaymentSettingsRow | null): PaymentSettingsResponse {
  if (!row) {
    return { provider: null, mode: null, enabled: false, hasSecretKey: false, publicKey: null };
  }
  return {
    provider: row.provider,
    mode: row.mode,
    enabled: row.enabled,
    hasSecretKey: Boolean(row.secretKeyEncrypted),
    publicKey: row.publicKey,
  };
}

export async function upsertPaymentSettings(
  db: Database,
  tenantId: string,
  input: PaymentSettingsRequest,
): Promise<void> {
  const secretKeyEncrypted = encryptSecret(input.secretKey);
  await db
    .insert(tenantPaymentSettings)
    .values({
      tenantId,
      provider: input.provider,
      publicKey: input.publicKey,
      secretKeyEncrypted,
      mode: input.mode,
      enabled: true,
    })
    .onConflictDoUpdate({
      target: tenantPaymentSettings.tenantId,
      set: {
        provider: input.provider,
        publicKey: input.publicKey,
        secretKeyEncrypted,
        mode: input.mode,
        enabled: true,
        updatedAt: new Date(),
      },
    });
}
