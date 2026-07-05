import { eq } from "drizzle-orm";
import { paymentWebhookEvents, type Database } from "@platform/db";

export type WebhookEventRow = typeof paymentWebhookEvents.$inferSelect;

export interface RecordWebhookEventParams {
  tenantId: string | null;
  provider: "paystack" | "flutterwave";
  eventReference: string;
  payload: unknown;
}

/**
 * Inserts the event row, relying on the (provider, event_reference) unique
 * index to make this idempotent under concurrent duplicate deliveries -
 * returns null if a row already existed (this call lost the race / it's a
 * genuine replay), meaning the caller must acknowledge without reprocessing.
 */
export async function tryRecordWebhookEvent(
  db: Database,
  params: RecordWebhookEventParams,
): Promise<WebhookEventRow | null> {
  const [row] = await db
    .insert(paymentWebhookEvents)
    .values(params)
    .onConflictDoNothing({
      target: [paymentWebhookEvents.provider, paymentWebhookEvents.eventReference],
    })
    .returning();
  return row ?? null;
}

export async function markWebhookEventProcessed(db: Database, id: string): Promise<void> {
  await db
    .update(paymentWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(paymentWebhookEvents.id, id));
}
