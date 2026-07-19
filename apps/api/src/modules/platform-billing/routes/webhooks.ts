import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  tryRecordPlatformWebhookEvent,
  markPlatformWebhookEventProcessed,
} from "../lib/platform-billing-webhook-events-store.js";
import {
  markSubscriptionActive,
  markSubscriptionPastDue,
  cancelSubscription,
  findSubscriptionByOrg,
} from "../lib/platform-subscriptions-store.js";
import { findPlatformPlan } from "../lib/platform-plans-store.js";
import { recordPlatformTransaction } from "../lib/platform-transactions-store.js";
import { subscriptionVatPortionCents } from "../lib/vat.js";

// Platform's own Paystack secret — distinct from tenant payment settings.
// Never read PAYSTACK_SECRET_KEY here; that key belongs to tenant payment
// settings and must never be conflated with this billing surface.
function getPlatformPaystackSecret(): string {
  const key = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PLATFORM_PAYSTACK_SECRET_KEY is not set");
  return key;
}

function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", getPlatformPaystackSecret())
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

// Paystack subscription webhook payload shapes we act on.
interface ChargeSuccessPayload {
  event: "charge.success";
  data: {
    reference: string;
    amount: number; // in kobo
    channel?: string; // card / bank / ussd / ... — surfaced as payment method
    customer: { customer_code: string; email: string };
    subscription_code?: string;
    metadata?: { organization_id?: string };
  };
}

interface InvoicePaymentFailedPayload {
  event: "invoice.payment_failed";
  data: {
    reference: string;
    gateway_response?: string; // human-readable failure reason from Paystack
    subscription: { subscription_code: string };
    customer: { customer_code: string };
    metadata?: { organization_id?: string };
  };
}

interface SubscriptionDisablePayload {
  event: "subscription.disable";
  data: {
    subscription_code: string;
    customer: { customer_code: string };
    metadata?: { organization_id?: string };
  };
}

type PlatformWebhookPayload =
  | ChargeSuccessPayload
  | InvoicePaymentFailedPayload
  | SubscriptionDisablePayload
  | { event: string; data: Record<string, unknown> };

async function handleChargeSuccess(
  app: FastifyInstance,
  payload: ChargeSuccessPayload,
): Promise<void> {
  const db = app.getDb();
  const orgId = payload.data.metadata?.organization_id;
  if (!orgId) {
    app.log.warn({ reference: payload.data.reference }, "platform-billing: charge.success missing organization_id in metadata");
    return;
  }

  // Resolve tier + interval so the revenue split can break subscription
  // revenue down by tier and monthly/annual (SuperAdmin.docx Tab 1, Zone 2).
  const subscription = await findSubscriptionByOrg(db, orgId);
  const plan = subscription ? await findPlatformPlan(db, subscription.planId) : null;
  const billingInterval = subscription?.billingInterval ?? "monthly";

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingInterval === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await markSubscriptionActive(db, orgId, {
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  });

  await recordPlatformTransaction(db, {
    organizationId: orgId,
    type: "subscription",
    amountCents: payload.data.amount,
    vatCents: subscriptionVatPortionCents(payload.data.amount),
    paystackReference: payload.data.reference,
    status: "success",
    metadata: {
      subscriptionCode: payload.data.subscription_code,
      customerCode: payload.data.customer.customer_code,
      planName: plan?.name,
      billingInterval,
      channel: payload.data.channel,
    },
  });

  app.log.info({ orgId, reference: payload.data.reference }, "platform-billing: subscription payment confirmed");
}

async function handlePaymentFailed(
  app: FastifyInstance,
  payload: InvoicePaymentFailedPayload,
): Promise<void> {
  const db = app.getDb();
  const orgId = payload.data.metadata?.organization_id;
  if (!orgId) {
    app.log.warn({ reference: payload.data.reference }, "platform-billing: invoice.payment_failed missing organization_id");
    return;
  }

  await markSubscriptionPastDue(db, orgId);

  await recordPlatformTransaction(db, {
    organizationId: orgId,
    type: "subscription",
    amountCents: 0,
    vatCents: 0,
    paystackReference: payload.data.reference,
    status: "failed",
    metadata: {
      subscriptionCode: payload.data.subscription.subscription_code,
      customerCode: payload.data.customer.customer_code,
      failureReason: payload.data.gateway_response,
    },
  });

  app.log.warn({ orgId }, "platform-billing: payment failed — 48h grace period started");
}

async function handleSubscriptionDisable(
  app: FastifyInstance,
  payload: SubscriptionDisablePayload,
): Promise<void> {
  const orgId = payload.data.metadata?.organization_id;
  if (!orgId) {
    app.log.warn({ subscriptionCode: payload.data.subscription_code }, "platform-billing: subscription.disable missing organization_id");
    return;
  }
  await cancelSubscription(app.getDb(), orgId);
  app.log.info({ orgId }, "platform-billing: subscription cancelled via Paystack webhook");
}

export default async function platformBillingWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Scoped content-type parser: preserve raw bytes for signature verification.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body;
      if (body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body.toString("utf8")));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post("/platform-billing/webhooks/paystack", async (request, reply) => {
    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body), "utf8");

    const signature = request.headers["x-paystack-signature"] as string | undefined;
    let secretAvailable = true;
    try {
      getPlatformPaystackSecret();
    } catch {
      secretAvailable = false;
    }

    if (secretAvailable && !verifyPaystackSignature(rawBody, signature)) {
      return reply.code(400).send({ error: "invalid_signature" });
    }

    const payload = request.body as PlatformWebhookPayload;
    const eventType = payload.event;

    // Build a stable dedup key from event type + reference-like field.
    const refField =
      "data" in payload && payload.data
        ? ((payload.data as Record<string, unknown>).reference as string | undefined) ??
          ((payload.data as Record<string, unknown>).subscription_code as string | undefined) ??
          ""
        : "";
    const eventReference = `${eventType}:${refField}`;

    const recorded = await tryRecordPlatformWebhookEvent(app.getDb(), {
      eventReference,
      eventType,
      payload,
    });
    if (!recorded) {
      // Duplicate delivery — acknowledge without reprocessing.
      return reply.code(200).send({ ok: true });
    }

    try {
      if (payload.event === "charge.success") {
        await handleChargeSuccess(app, payload as ChargeSuccessPayload);
      } else if (payload.event === "invoice.payment_failed") {
        await handlePaymentFailed(app, payload as InvoicePaymentFailedPayload);
      } else if (payload.event === "subscription.disable") {
        await handleSubscriptionDisable(app, payload as SubscriptionDisablePayload);
      }
      // Other events (subscription.create, etc.) are recorded for audit but
      // require no state change on our side.
    } finally {
      await markPlatformWebhookEventProcessed(app.getDb(), recorded.id);
    }

    return reply.code(200).send({ ok: true });
  });
}
