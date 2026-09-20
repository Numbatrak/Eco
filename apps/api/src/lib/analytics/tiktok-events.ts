import { createHash } from "node:crypto";
import { decryptSecret } from "../encryption.js";

const TIKTOK_EVENTS_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function hashPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface TiktokCapiOrder {
  id: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  customerPhone: string | null;
}

export interface TiktokCapiSettings {
  tiktokPixelId: string;
  tiktokCapiTokenEncrypted: string;
}

/**
 * Dispatches a server-side CompletePayment event to TikTok's Events API -
 * TikTok's equivalent of Meta's Conversions API (see meta-capi.ts, which
 * this mirrors: same trigger point - order settlement in
 * apps/api/src/modules/checkout/lib/orders.ts - same PII-hashing approach,
 * and the same `event_id` = order id dedup strategy against the browser
 * pixel's equivalent event for the same order.
 *
 * ASSUMPTION / UNVERIFIED: this implementation was written without live
 * access to TikTok's current Events API reference, so the exact request
 * shape below is reconstructed from the publicly documented Events API
 * (v1.3) format rather than confirmed against a real payload:
 *   - Endpoint + `Access-Token` header name.
 *   - Top-level `event_source: "web"` / `event_source_id: <pixel id>`.
 *   - `data[]` entries shaped as `{ event, event_time, event_id, user, properties }`.
 *   - `user.email` / `user.phone` as raw sha256 hex digests (TikTok, like
 *     Meta, expects lowercase-trimmed-then-hashed PII, but confirm they
 *     don't also expect these wrapped in arrays the way Meta's `em`/`ph`
 *     fields are).
 *   - `properties.value` / `properties.currency` naming and that a bare
 *     number (not a string) is accepted for `value`.
 * Before relying on this in production, verify each of the above against
 * TikTok's current Events API docs and a real Test Events run in TikTok's
 * Events Manager.
 */
export async function sendPurchaseTiktokEventsApiEvent(
  order: TiktokCapiOrder,
  settings: TiktokCapiSettings,
): Promise<void> {
  const token = decryptSecret(settings.tiktokCapiTokenEncrypted);

  const user: Record<string, string> = {
    email: hashPii(order.customerEmail),
  };
  if (order.customerPhone) {
    user.phone = hashPii(order.customerPhone.replace(/[^0-9]/g, ""));
  }

  const payload = {
    event_source: "web",
    event_source_id: settings.tiktokPixelId,
    data: [
      {
        event: "CompletePayment",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.id,
        user,
        properties: {
          currency: order.currency,
          value: order.totalCents / 100,
        },
      },
    ],
  };

  const response = await fetch(TIKTOK_EVENTS_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Access-Token": token,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`TikTok Events API request failed with status ${response.status}`);
  }
}
