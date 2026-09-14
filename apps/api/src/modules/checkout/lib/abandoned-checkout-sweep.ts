import type { FastifyBaseLogger } from "fastify";
import type { Database } from "@platform/db";
import { sendEmail } from "../../auth/lib/email.js";
import { abandonedCheckoutEmail } from "../../../lib/email-templates.js";
import { sendAbandonedCheckoutWhatsApp } from "../../../lib/whatsapp.js";
import { getProviderForTenant } from "../../payments/lib/provider-factory.js";
import { findTenantSettings } from "../../sites/lib/site-store.js";
import { findAbandonedCheckoutCandidates, markOrderAbandoned, markOrderPaid, markOrderFailed, type OrderRow } from "./orders.js";

export interface AbandonedCheckoutSweepResult {
  flagged: string[];
  recoveredByReverify: string[];
}

const ABANDONMENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Cron tick - call on a regular schedule (see sweep-abandoned-cron.ts route).
 * A pending online-payment order that's sat past the threshold either (a)
 * actually succeeded and the webhook/status-poll just never landed - caught
 * here by re-verifying against the provider before giving up on it - or (b)
 * really was abandoned, in which case it's flagged and the shopper gets a
 * one-time recovery nudge.
 */
export async function runAbandonedCheckoutSweep(db: Database, log: FastifyBaseLogger): Promise<AbandonedCheckoutSweepResult> {
  const candidates = await findAbandonedCheckoutCandidates(db, new Date(Date.now() - ABANDONMENT_THRESHOLD_MS));

  const flagged: string[] = [];
  const recoveredByReverify: string[] = [];

  for (const order of candidates) {
    const recovered = await reverifyIfPossible(db, log, order);
    if (recovered) {
      recoveredByReverify.push(order.id);
      continue;
    }

    const wasFlagged = await markOrderAbandoned(db, order.id);
    if (!wasFlagged) continue; // already settled or flagged by a concurrent run
    flagged.push(order.id);
    await notifyAbandoned(db, log, order);
  }

  if (flagged.length > 0) {
    log.info({ count: flagged.length, orderIds: flagged }, "checkout: flagged abandoned checkouts");
  }
  return { flagged, recoveredByReverify };
}

/** Safety net for a missed webhook - only re-verifies orders that actually have a payment reference to check. */
async function reverifyIfPossible(db: Database, log: FastifyBaseLogger, order: OrderRow): Promise<boolean> {
  if (!order.paymentReference) return false;
  const provider = await getProviderForTenant(db, order.tenantId);
  if (!provider) return false;

  const verified = await provider.verifyTransaction(order.paymentReference);
  if (verified.status === "success") {
    return markOrderPaid(db, log, order);
  }
  if (verified.status === "failed") {
    await markOrderFailed(db, order);
  }
  return false;
}

/** Best-effort - a notification failure must not stop the sweep from flagging the rest. */
async function notifyAbandoned(db: Database, log: FastifyBaseLogger, order: OrderRow): Promise<void> {
  const tenant = await findTenantSettings(db, order.tenantId);
  const appUrl = process.env.STOREFRONT_APP_URL ?? "http://localhost:3000";
  const resumeUrl = `${appUrl}/sites/${tenant?.subdomain ?? order.tenantId}/order/${order.id}`;
  const amount = (order.totalCents / 100).toFixed(2);

  try {
    await sendEmail(log, {
      to: order.customerEmail,
      subject: `Complete your order ${order.orderNumber}`,
      body: abandonedCheckoutEmail({
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        amount,
        currency: order.currency,
        resumeUrl,
      }),
    });
  } catch (err) {
    log.warn({ err, orderId: order.id }, "Abandoned checkout email failed");
  }

  if (order.customerPhone) {
    try {
      await sendAbandonedCheckoutWhatsApp(db, order.tenantId, log, {
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        amount,
        currency: order.currency,
      });
    } catch (err) {
      log.warn({ err, orderId: order.id }, "Abandoned checkout WhatsApp failed");
    }
  }
}
