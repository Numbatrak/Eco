import { createHash } from "node:crypto";
import { decryptSecret } from "../encryption.js";

const META_GRAPH_VERSION = "v21.0";

function hashPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface CapiOrder {
  id: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  customerPhone: string | null;
}

export interface CapiSettings {
  metaPixelId: string;
  metaCapiTokenEncrypted: string;
}

/**
 * Dispatches a server-side Purchase event to Meta's Conversions API, hashed
 * per Meta's spec. `event_id` = order id so it dedupes against the browser
 * Pixel's Purchase event for the same order (Meta Test Events shows this as
 * "Deduplicated" when both fire with the same id).
 */
export async function sendPurchaseCapiEvent(order: CapiOrder, settings: CapiSettings): Promise<void> {
  const token = decryptSecret(settings.metaCapiTokenEncrypted);
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${settings.metaPixelId}/events?access_token=${encodeURIComponent(token)}`;

  const userData: Record<string, string[]> = {
    em: [hashPii(order.customerEmail)],
  };
  if (order.customerPhone) {
    userData.ph = [hashPii(order.customerPhone.replace(/[^0-9]/g, ""))];
  }

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.id,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: order.currency,
          value: order.totalCents / 100,
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Meta CAPI request failed with status ${response.status}`);
  }
}
