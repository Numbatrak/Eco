import { eq } from "drizzle-orm";
import { platformBillingWebhookEvents, type Database } from "@platform/db";

export type PlatformBillingWebhookEventRow = typeof platformBillingWebhookEvents.$inferSelect;

/**
 * Inserts the event row using the event_reference unique index for idempotency.
 * Returns null if a row already existed — caller must acknowledge without
 * reprocessing. Same pattern as tryRecordWebhookEvent in the tenant payments
 * module (apps/api/src/modules/payments/lib/webhook-events-store.ts).
 */
export async function tryRecordPlatformWebhookEvent(
  db: Database,
  params: { eventReference: string; eventType: string; payload: unknown },
): Promise<PlatformBillingWebhookEventRow | null> {
  const [row] = await db
    .insert(platformBillingWebhookEvents)
    .values(params)
    .onConflictDoNothing({ target: [platformBillingWebhookEvents.eventReference] })
    .returning();
  return row ?? null;
}

export async function markPlatformWebhookEventProcessed(
  db: Database,
  id: string,
): Promise<void> {
  await db
    .update(platformBillingWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(platformBillingWebhookEvents.id, id));
}
