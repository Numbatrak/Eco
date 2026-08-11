import { eq } from "drizzle-orm";
import { tenantWhatsappSettings, type Database } from "@platform/db";
import type { WhatsappSettingsResponse } from "@platform/shared-types";
import { encryptSecret } from "../../../lib/encryption.js";

export type WhatsappSettingsRow = typeof tenantWhatsappSettings.$inferSelect;

export async function findWhatsappSettings(
  db: Database,
  tenantId: string,
): Promise<WhatsappSettingsRow | null> {
  const [row] = await db
    .select()
    .from(tenantWhatsappSettings)
    .where(eq(tenantWhatsappSettings.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

export function serializeWhatsappSettings(row: WhatsappSettingsRow | null): WhatsappSettingsResponse {
  if (!row) {
    return {
      connected: false,
      wabaId: null,
      phoneNumberId: null,
      phoneNumber: null,
      displayName: null,
      accountStatus: null,
      enabled: false,
    };
  }
  return {
    connected: true,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    phoneNumber: row.phoneNumber,
    displayName: row.displayName,
    accountStatus: row.accountStatus,
    enabled: row.enabled,
  };
}

export interface UpsertWhatsappSettingsInput {
  wabaId: string;
  phoneNumberId: string;
  phoneNumber?: string;
  displayName?: string;
  accessToken: string;
  businessPortfolioId?: string;
}

export async function upsertWhatsappSettings(
  db: Database,
  tenantId: string,
  input: UpsertWhatsappSettingsInput,
): Promise<void> {
  const accessTokenEncrypted = encryptSecret(input.accessToken);
  await db
    .insert(tenantWhatsappSettings)
    .values({
      tenantId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      phoneNumber: input.phoneNumber ?? null,
      displayName: input.displayName ?? null,
      accessTokenEncrypted,
      businessPortfolioId: input.businessPortfolioId ?? null,
      accountStatus: "pending",
      enabled: true,
    })
    .onConflictDoUpdate({
      target: tenantWhatsappSettings.tenantId,
      set: {
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber ?? null,
        displayName: input.displayName ?? null,
        accessTokenEncrypted,
        businessPortfolioId: input.businessPortfolioId ?? null,
        accountStatus: "pending",
        enabled: true,
        updatedAt: new Date(),
      },
    });
}

export async function deleteWhatsappSettings(
  db: Database,
  tenantId: string,
): Promise<void> {
  await db
    .delete(tenantWhatsappSettings)
    .where(eq(tenantWhatsappSettings.tenantId, tenantId));
}
