import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import checkoutStatusRoutes from "./status.js";

vi.mock("../../sites/lib/site-store.js", () => ({
  findPublishedTenantBySubdomain: vi.fn(),
}));
vi.mock("../lib/orders.js", () => ({
  findOrderById: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderFailed: vi.fn(),
}));
vi.mock("../../payments/lib/payment-settings-store.js", () => ({
  findPaymentSettings: vi.fn(),
}));
vi.mock("../../payments/lib/provider-factory.js", () => ({
  buildProvider: vi.fn(),
}));

const { findPublishedTenantBySubdomain } = await import("../../sites/lib/site-store.js");
const { findOrderById, markOrderPaid, markOrderFailed } = await import("../lib/orders.js");
const { findPaymentSettings } = await import("../../payments/lib/payment-settings-store.js");
const { buildProvider } = await import("../../payments/lib/provider-factory.js");

const tenant = { id: "tenant-1", name: "Acme", subdomain: "acme" };

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order-1",
    tenantId: tenant.id,
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
    ...overrides,
  };
}

describe("GET /public/sites/:subdomain/checkout/:orderId/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findPublishedTenantBySubdomain).mockResolvedValue(tenant);
    vi.mocked(findPaymentSettings).mockResolvedValue({
      tenantId: tenant.id,
      provider: "paystack",
      publicKey: "pk_test_x",
      secretKeyEncrypted: "encrypted",
      mode: "test",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  it("does not mark the order paid when the provider reports the transaction is still pending", async () => {
    const pendingOrder = makeOrder();
    vi.mocked(findOrderById).mockResolvedValue(pendingOrder as never);
    const verifyTransaction = vi
      .fn()
      .mockResolvedValue({ status: "pending", reference: "paystack-ref-1" });
    vi.mocked(buildProvider).mockReturnValue({
      initializeTransaction: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      verifyTransaction,
    } as never);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutStatusRoutes] });

    const response = await app.inject({
      method: "GET",
      url: "/public/sites/acme/checkout/order-1/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("pending");
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(markOrderFailed).not.toHaveBeenCalled();
  });

  it("marks the order paid only after the provider verifies the transaction as successful", async () => {
    const pendingOrder = makeOrder();
    const paidOrder = makeOrder({ status: "paid" });
    vi.mocked(findOrderById).mockResolvedValueOnce(pendingOrder as never);
    vi.mocked(findOrderById).mockResolvedValueOnce(paidOrder as never);
    vi.mocked(markOrderPaid).mockResolvedValue(true);
    const verifyTransaction = vi
      .fn()
      .mockResolvedValue({ status: "success", reference: "paystack-ref-1" });
    vi.mocked(buildProvider).mockReturnValue({
      initializeTransaction: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      verifyTransaction,
    } as never);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutStatusRoutes] });

    const response = await app.inject({
      method: "GET",
      url: "/public/sites/acme/checkout/order-1/status",
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTransaction).toHaveBeenCalledWith("paystack-ref-1");
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
    expect(response.json().status).toBe("paid");
  });

  it("does not re-verify with the provider once an order is already settled", async () => {
    const paidOrder = makeOrder({ status: "paid" });
    vi.mocked(findOrderById).mockResolvedValue(paidOrder as never);
    const verifyTransaction = vi.fn();
    vi.mocked(buildProvider).mockReturnValue({
      initializeTransaction: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      verifyTransaction,
    } as never);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutStatusRoutes] });

    const response = await app.inject({
      method: "GET",
      url: "/public/sites/acme/checkout/order-1/status",
    });

    expect(response.statusCode).toBe(200);
    expect(verifyTransaction).not.toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
});
