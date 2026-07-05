import type { Database } from "@platform/db";
import { decryptSecret } from "../../../lib/encryption.js";
import { PaystackProvider } from "./paystack.js";
import { FlutterwaveProvider } from "./flutterwave.js";
import { findPaymentSettings, type PaymentSettingsRow } from "./payment-settings-store.js";
import type { PaymentProvider } from "./provider.js";

export function buildProvider(settings: PaymentSettingsRow): PaymentProvider | null {
  if (!settings.enabled || !settings.secretKeyEncrypted || !settings.publicKey) {
    return null;
  }
  const secretKey = decryptSecret(settings.secretKeyEncrypted);
  if (settings.provider === "paystack") {
    return new PaystackProvider(settings.publicKey, secretKey);
  }
  return new FlutterwaveProvider(settings.publicKey, secretKey);
}

export async function getProviderForTenant(
  db: Database,
  tenantId: string,
): Promise<PaymentProvider | null> {
  const settings = await findPaymentSettings(db, tenantId);
  if (!settings) {
    return null;
  }
  return buildProvider(settings);
}
