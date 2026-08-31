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
    // No row at all = never touched payments - checkout.ts treats this the
    // same as an explicit "cod" collectionMethod, so reflect that here too.
    return {
      collectionMethod: "cod",
      provider: null,
      mode: null,
      enabled: false,
      hasSecretKey: false,
      publicKey: null,
    };
  }
  return {
    collectionMethod: row.collectionMethod,
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
  // A pure-COD tenant needs no gateway at all - never leave stray provider
  // config lying around for one, regardless of what the request happened to
  // include (defense in depth on top of the schema-level requiredness).
  const isCodOnly = input.collectionMethod === "cod";
  const provider = isCodOnly ? null : (input.provider ?? null);
  const publicKey = isCodOnly ? null : (input.publicKey ?? null);
  const mode = isCodOnly ? null : (input.mode ?? null);
  const secretKeyEncrypted = isCodOnly || !input.secretKey ? null : encryptSecret(input.secretKey);

  await db
    .insert(tenantPaymentSettings)
    .values({
      tenantId,
      collectionMethod: input.collectionMethod,
      provider,
      publicKey,
      secretKeyEncrypted,
      mode: mode ?? "test",
      enabled: true,
    })
    .onConflictDoUpdate({
      target: tenantPaymentSettings.tenantId,
      set: {
        collectionMethod: input.collectionMethod,
        provider,
        publicKey,
        secretKeyEncrypted,
        mode: mode ?? "test",
        enabled: true,
        updatedAt: new Date(),
      },
    });
}
