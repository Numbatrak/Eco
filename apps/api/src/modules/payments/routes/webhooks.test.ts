import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import webhookRoutes from "./webhooks.js";

vi.mock("../../checkout/lib/orders.js", () => ({
  findOrderByReference: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderFailed: vi.fn(),
}));
vi.mock("../lib/payment-settings-store.js", () => ({
  findPaymentSettings: vi.fn(),
}));
vi.mock("../lib/provider-factory.js", () => ({
  buildProvider: vi.fn(),
}));
vi.mock("../lib/webhook-events-store.js", () => ({
  tryRecordWebhookEvent: vi.fn(),
  markWebhookEventProcessed: vi.fn(async () => {}),
}));

const { findOrderByReference, markOrderPaid, markOrderFailed } =
  await import("../../checkout/lib/orders.js");
const { findPaymentSettings } = await import("../lib/payment-settings-store.js");
const { buildProvider } = await import("../lib/provider-factory.js");
const { tryRecordWebhookEvent, markWebhookEventProcessed } =
  await import("../lib/webhook-events-store.js");

const order = {
  id: "order-1",
  tenantId: "tenant-1",
  orderNumber: "ABCD1234",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: null,
  status: "pending",
  currency: "NGN",
  subtotalCents: 2000,
  totalCents: 2000,
  paymentProvider: "paystack",
  paymentReference: "paystack-ref-1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const settings = {
  tenantId: "tenant-1",
  provider: "paystack",
  publicKey: "pk_test_x",
  secretKeyEncrypted: "encrypted",
  mode: "test" as const,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    initializeTransaction: vi.fn(),
    verifyWebhookSignature: vi.fn().mockReturnValue(true),
    verifyTransaction: vi
      .fn()
      .mockResolvedValue({ status: "success", reference: "paystack-ref-1" }),
    ...overrides,
  };
}

const payload = { event: "charge.success", data: { reference: "paystack-ref-1" } };

describe("POST /webhooks/paystack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findOrderByReference).mockResolvedValue(order as never);
    vi.mocked(findPaymentSettings).mockResolvedValue(settings as never);
  });

  it("rejects a webhook with an invalid signature and never processes it", async () => {
    const provider = makeProvider({ verifyWebhookSignature: vi.fn().mockReturnValue(false) });
    vi.mocked(buildProvider).mockReturnValue(provider as never);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [webhookRoutes] });

    const response = await app.inject({ method: "POST", url: "/webhooks/paystack", payload });

    expect(response.statusCode).toBe(400);
    expect(tryRecordWebhookEvent).not.toHaveBeenCalled();
    expect(provider.verifyTransaction).not.toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("processes a verified webhook once and acknowledges a duplicate delivery without reprocessing", async () => {
    const provider = makeProvider();
    vi.mocked(buildProvider).mockReturnValue(provider as never);
    vi.mocked(markOrderPaid).mockResolvedValue(true);

    // First delivery "wins" the insert race - tryRecordWebhookEvent returns a row.
    vi.mocked(tryRecordWebhookEvent).mockResolvedValueOnce({
      id: "event-1",
      tenantId: order.tenantId,
      provider: "paystack",
      eventReference: "paystack-ref-1",
      payload,
      processedAt: null,
      createdAt: new Date(),
    } as never);
    // The replay hits the unique-index conflict and gets null back.
    vi.mocked(tryRecordWebhookEvent).mockResolvedValueOnce(null);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [webhookRoutes] });

    const first = await app.inject({ method: "POST", url: "/webhooks/paystack", payload });
    const second = await app.inject({ method: "POST", url: "/webhooks/paystack", payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(provider.verifyTransaction).toHaveBeenCalledTimes(1);
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
    expect(markWebhookEventProcessed).toHaveBeenCalledTimes(1);
  });

  it("never marks the order paid when the provider's own verify call doesn't report success", async () => {
    const provider = makeProvider({
      verifyTransaction: vi
        .fn()
        .mockResolvedValue({ status: "pending", reference: "paystack-ref-1" }),
    });
    vi.mocked(buildProvider).mockReturnValue(provider as never);
    vi.mocked(tryRecordWebhookEvent).mockResolvedValue({
      id: "event-2",
      tenantId: order.tenantId,
      provider: "paystack",
      eventReference: "paystack-ref-1",
      payload,
      processedAt: null,
      createdAt: new Date(),
    } as never);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [webhookRoutes] });

    const response = await app.inject({ method: "POST", url: "/webhooks/paystack", payload });

    expect(response.statusCode).toBe(200);
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(markOrderFailed).not.toHaveBeenCalled();
  });
});
