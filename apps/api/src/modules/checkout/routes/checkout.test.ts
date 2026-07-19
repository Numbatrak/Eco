import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import checkoutRoutes from "./checkout.js";

vi.mock("../../cart/lib/cart-request.js", () => ({
  resolveCartContext: vi.fn(),
  isCartContextError: (value: unknown) =>
    value !== null && typeof value === "object" && "error" in (value as object),
}));
vi.mock("../../cart/lib/cart-store.js", () => ({
  serializeCart: vi.fn(),
  findUnpublishedCartItems: vi.fn(),
  deleteCart: vi.fn(async () => {}),
}));
vi.mock("../../cart/lib/cart-cookie.js", () => ({
  clearCartTokenCookie: vi.fn(),
}));
vi.mock("../../payments/lib/payment-settings-store.js", () => ({
  findPaymentSettings: vi.fn(),
}));
vi.mock("../../payments/lib/provider-factory.js", () => ({
  buildProvider: vi.fn(),
}));
vi.mock("../lib/orders.js", () => ({
  createPendingOrder: vi.fn(),
  setOrderPaymentReference: vi.fn(async () => {}),
}));
vi.mock("../../delivery/lib/delivery-settings-store.js", async () => {
  const actual = await vi.importActual<typeof import("../../delivery/lib/delivery-settings-store.js")>(
    "../../delivery/lib/delivery-settings-store.js",
  );
  return { ...actual, findDeliverySettings: vi.fn() };
});
vi.mock("../../customers/lib/customers.js", () => ({
  upsertCustomer: vi.fn(),
}));

const { resolveCartContext } = await import("../../cart/lib/cart-request.js");
const { serializeCart, findUnpublishedCartItems } = await import("../../cart/lib/cart-store.js");
const { findPaymentSettings } = await import("../../payments/lib/payment-settings-store.js");
const { buildProvider } = await import("../../payments/lib/provider-factory.js");
const { createPendingOrder } = await import("../lib/orders.js");
const { findDeliverySettings } = await import("../../delivery/lib/delivery-settings-store.js");
const { upsertCustomer } = await import("../../customers/lib/customers.js");

const tenant = { id: "tenant-1", name: "Acme", subdomain: "acme" };
const cart = {
  id: "cart-1",
  tenantId: tenant.id,
  cartToken: "hashed-token",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const checkoutPayload = {
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  deliveryAddress: "1 Broad Street",
  deliveryCity: "Lagos",
  deliveryState: "Lagos",
};

async function postCheckout(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.inject({
    method: "POST",
    url: "/public/sites/acme/checkout",
    payload: checkoutPayload,
  });
}

describe("POST /public/sites/:subdomain/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveCartContext).mockResolvedValue({ tenant, cart });
    vi.mocked(findDeliverySettings).mockResolvedValue(null);
    vi.mocked(upsertCustomer).mockResolvedValue({
      id: "customer-1",
      tenantId: tenant.id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: null,
      address: null,
      city: null,
      state: null,
      orderCount: 0,
      totalSpentCents: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("rejects checkout when the cart is empty", async () => {
    vi.mocked(serializeCart).mockResolvedValue({
      id: cart.id,
      items: [],
      subtotalCents: 0,
      currency: null,
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "cart_empty" });
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects checkout when a cart item is no longer published", async () => {
    vi.mocked(serializeCart).mockResolvedValue({
      id: cart.id,
      items: [
        {
          id: "item-1",
          productId: "product-1",
          variantId: null,
          variantLabel: null,
          name: "Widget",
          quantity: 1,
          unitPriceSnapshotCents: 1000,
          lineTotalCents: 1000,
        },
      ],
      subtotalCents: 1000,
      currency: "NGN",
    });
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([
      {
        id: "item-1",
        productId: "product-1",
        variantId: null,
        variantSize: null,
        variantColor: null,
        name: "Widget",
        quantity: 1,
        unitPriceSnapshotCents: 1000,
        currency: "NGN",
        status: "draft",
      },
    ]);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("cart_has_unpublished_items");
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects checkout when the tenant has no payment settings configured", async () => {
    vi.mocked(serializeCart).mockResolvedValue({
      id: cart.id,
      items: [
        {
          id: "item-1",
          productId: "product-1",
          variantId: null,
          variantLabel: null,
          name: "Widget",
          quantity: 1,
          unitPriceSnapshotCents: 1000,
          lineTotalCents: 1000,
        },
      ],
      subtotalCents: 1000,
      currency: "NGN",
    });
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([]);
    vi.mocked(findPaymentSettings).mockResolvedValue(null);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("payments_not_configured");
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("creates a pending order and returns the provider's hosted checkout URL on success", async () => {
    vi.mocked(serializeCart).mockResolvedValue({
      id: cart.id,
      items: [
        {
          id: "item-1",
          productId: "product-1",
          variantId: null,
          variantLabel: null,
          name: "Widget",
          quantity: 2,
          unitPriceSnapshotCents: 1000,
          lineTotalCents: 2000,
        },
      ],
      subtotalCents: 2000,
      currency: "NGN",
    });
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([]);
    vi.mocked(findPaymentSettings).mockResolvedValue({
      tenantId: tenant.id,
      provider: "paystack",
      publicKey: "pk_test_x",
      secretKeyEncrypted: "encrypted",
      mode: "test",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const initializeTransaction = vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.paystack.com/abc123",
      reference: "paystack-ref-1",
    });
    vi.mocked(buildProvider).mockReturnValue({
      initializeTransaction,
      verifyTransaction: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    });
    vi.mocked(createPendingOrder).mockResolvedValue({
      id: "order-1",
      tenantId: tenant.id,
      customerId: null,
      orderNumber: "ABCD1234",
      customerName: checkoutPayload.customerName,
      customerEmail: checkoutPayload.customerEmail,
      customerPhone: null,
      status: "pending",
      currency: "NGN",
      subtotalCents: 2000,
      deliveryAddress: null,
      deliveryCity: null,
      deliveryState: null,
      deliveryFeeCents: 0,
      vatRateBps: null,
      vatAmountCents: 0,
      totalCents: 2000,
      paymentProvider: "paystack",
      paymentReference: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      referrer: null,
      landingPath: null,
      fbclid: null,
      ttclid: null,
      gclid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      orderId: "order-1",
      orderNumber: "ABCD1234",
      checkoutUrl: "https://checkout.paystack.com/abc123",
    });
    expect(initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "order-1", totalCents: 2000, currency: "NGN" }),
    );
  });
});
