import { eq } from "drizzle-orm";
import { tenantDeliverySettings, type Database } from "@platform/db";
import type { DeliverySettingsRequest, DeliverySettingsResponse } from "@platform/shared-types";

export type DeliverySettingsRow = typeof tenantDeliverySettings.$inferSelect;

const DEFAULT_SETTINGS: DeliverySettingsResponse = {
  vatEnabled: false,
  vatRateBps: 0,
  deliveryFeeCents: 0,
  freeDeliveryThresholdCents: null,
};

export async function findDeliverySettings(
  db: Database,
  tenantId: string,
): Promise<DeliverySettingsRow | null> {
  const [row] = await db
    .select()
    .from(tenantDeliverySettings)
    .where(eq(tenantDeliverySettings.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

export function serializeDeliverySettings(row: DeliverySettingsRow | null): DeliverySettingsResponse {
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  return {
    vatEnabled: row.vatEnabled,
    vatRateBps: row.vatRateBps,
    deliveryFeeCents: row.deliveryFeeCents,
    freeDeliveryThresholdCents: row.freeDeliveryThresholdCents,
  };
}

export async function upsertDeliverySettings(
  db: Database,
  tenantId: string,
  input: DeliverySettingsRequest,
): Promise<void> {
  await db
    .insert(tenantDeliverySettings)
    .values({
      tenantId,
      vatEnabled: input.vatEnabled,
      vatRateBps: input.vatRateBps,
      deliveryFeeCents: input.deliveryFeeCents,
      freeDeliveryThresholdCents: input.freeDeliveryThresholdCents ?? null,
    })
    .onConflictDoUpdate({
      target: tenantDeliverySettings.tenantId,
      set: {
        vatEnabled: input.vatEnabled,
        vatRateBps: input.vatRateBps,
        deliveryFeeCents: input.deliveryFeeCents,
        freeDeliveryThresholdCents: input.freeDeliveryThresholdCents ?? null,
        updatedAt: new Date(),
      },
    });
}
