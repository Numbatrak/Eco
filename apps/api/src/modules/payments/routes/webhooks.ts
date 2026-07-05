import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { findOrderByReference, markOrderPaid, markOrderFailed } from "../../checkout/lib/orders.js";
import { findPaymentSettings } from "../lib/payment-settings-store.js";
import { buildProvider } from "../lib/provider-factory.js";
import { tryRecordWebhookEvent, markWebhookEventProcessed } from "../lib/webhook-events-store.js";
import type { WebhookHeaders } from "../lib/provider.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

interface PaystackWebhookPayload {
  event?: string;
  data?: { reference?: string };
}

interface FlutterwaveWebhookPayload {
  event?: string;
  data?: { tx_ref?: string };
}

async function handleWebhook(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  providerKey: "paystack" | "flutterwave",
  reference: string,
  payload: unknown,
): Promise<void> {
  const db = app.getDb();

  const order = await findOrderByReference(db, reference);
  if (!order) {
    // No order maps to this reference, so there's no tenant secret to verify
    // the signature against - reject outright rather than trusting the body.
    await reply.code(400).send({ error: "Unknown transaction reference" });
    return;
  }

  const settings = await findPaymentSettings(db, order.tenantId);
  const provider = settings ? buildProvider(settings) : null;
  if (!settings || !provider || settings.provider !== providerKey) {
    await reply.code(400).send({ error: "Payment provider not configured for this tenant" });
    return;
  }

  const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(payload), "utf8");
  if (!provider.verifyWebhookSignature(rawBody, request.headers as WebhookHeaders)) {
    await reply.code(400).send({ error: "Invalid webhook signature" });
    return;
  }

  const recorded = await tryRecordWebhookEvent(db, {
    tenantId: order.tenantId,
    provider: providerKey,
    eventReference: reference,
    payload,
  });
  if (!recorded) {
    // Already recorded (a replay, or a concurrent delivery that won the
    // race) - acknowledge without reprocessing.
    await reply.code(200).send({ ok: true });
    return;
  }

  const verified = await provider.verifyTransaction(reference);
  if (verified.status === "success") {
    await markOrderPaid(db, app.log, order);
  } else if (verified.status === "failed") {
    await markOrderFailed(db, order);
  }

  await markWebhookEventProcessed(db, recorded.id);
  await reply.code(200).send({ ok: true });
}

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Scoped to this plugin's encapsulated context only - webhook signature
  // verification needs the exact raw bytes, everywhere else keeps Fastify's
  // normal JSON body parsing.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      req.rawBody = body;
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

  app.post("/webhooks/paystack", async (request, reply) => {
    const payload = request.body as PaystackWebhookPayload;
    const reference = payload?.data?.reference;
    if (!reference) {
      return reply.code(400).send({ error: "Missing transaction reference" });
    }
    return handleWebhook(app, request, reply, "paystack", reference, payload);
  });

  app.post("/webhooks/flutterwave", async (request, reply) => {
    const payload = request.body as FlutterwaveWebhookPayload;
    const reference = payload?.data?.tx_ref;
    if (!reference) {
      return reply.code(400).send({ error: "Missing transaction reference" });
    }
    return handleWebhook(app, request, reply, "flutterwave", reference, payload);
  });
}
