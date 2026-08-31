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
vi.mock("../../cart/lib/cart-store.js", async () => {
  const actual = await vi.importActual<typeof import("../../cart/lib/cart-store.js")>(
    "../../cart/lib/cart-store.js",
  );
  return {
    ...actual,
    getCartItemsWithProduct: vi.fn(),
    findUnpublishedCartItems: vi.fn(),
    deleteCart: vi.fn(async () => {}),
  };
});
vi.mock("../../delivery/lib/delivery-zone-store.js", () => ({
  findZoneRate: vi.fn(async () => null),
}));
vi.mock("../../discounts/lib/discounts-store.js", () => ({
  findActiveByCode: vi.fn(async () => null),
  listActiveAutomatic: vi.fn(async () => []),
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
  markOrderPaid: vi.fn(async () => true),
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
const { getCartItemsWithProduct, findUnpublishedCartItems } = await import("../../cart/lib/cart-store.js");
const { findPaymentSettings } = await import("../../payments/lib/payment-settings-store.js");
const { buildProvider } = await import("../../payments/lib/provider-factory.js");
const { createPendingOrder, markOrderPaid } = await import("../lib/orders.js");
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
    vi.mocked(getCartItemsWithProduct).mockResolvedValue([]);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "cart_empty" });
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects checkout when a cart item is no longer published", async () => {
    vi.mocked(getCartItemsWithProduct).mockResolvedValue([
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
        status: "published",
        collectionId: null,
      },
    ]);
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
        collectionId: null,
      },
    ]);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("cart_has_unpublished_items");
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("defaults to COD (no checkout URL, order placed immediately) when the tenant has no payment settings configured", async () => {
    vi.mocked(getCartItemsWithProduct).mockResolvedValue([
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
        status: "published",
        collectionId: null,
      },
    ]);
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([]);
    vi.mocked(findPaymentSettings).mockResolvedValue(null);
    vi.mocked(createPendingOrder).mockResolvedValue({
      id: "order-2",
      tenantId: tenant.id,
      customerId: null,
      orderNumber: "COD12345",
      customerName: checkoutPayload.customerName,
      customerEmail: checkoutPayload.customerEmail,
      customerPhone: null,
      status: "pending",
      currency: "NGN",
      subtotalCents: 1000,
      deliveryAddress: null,
      deliveryCity: null,
      deliveryState: null,
      deliveryFeeCents: 0,
      vatRateBps: null,
      vatAmountCents: 0,
      totalCents: 1000,
      paymentProvider: null,
      paymentMethod: "cod",
      source: "store",
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
      lastUtmSource: null,
      lastUtmMedium: null,
      lastUtmCampaign: null,
      lastUtmTerm: null,
      lastUtmContent: null,
      lastReferrer: null,
      lastLandingPath: null,
      lastFbclid: null,
      lastTtclid: null,
      lastGclid: null,
      discountId: null,
      discountCode: null,
      discountAmountCents: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      orderId: "order-2",
      orderNumber: "COD12345",
      checkoutUrl: null,
    });
    expect(createPendingOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentMethod: "cod", paymentProvider: null }),
    );
    expect(markOrderPaid).toHaveBeenCalled();
  });

  it("rejects checkout when the tenant allows both COD and prepaid but the buyer didn't pick one", async () => {
    vi.mocked(getCartItemsWithProduct).mockResolvedValue([
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
        status: "published",
        collectionId: null,
      },
    ]);
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([]);
    vi.mocked(findPaymentSettings).mockResolvedValue({
      tenantId: tenant.id,
      collectionMethod: "both",
      provider: "paystack",
      publicKey: "pk_test_x",
      secretKeyEncrypted: "encrypted",
      mode: "test",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [checkoutRoutes] });

    const response = await postCheckout(app);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("payment_method_required");
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("creates a pending order and returns the provider's hosted checkout URL on success", async () => {
    vi.mocked(getCartItemsWithProduct).mockResolvedValue([
      {
        id: "item-1",
        productId: "product-1",
        variantId: null,
        variantSize: null,
        variantColor: null,
        name: "Widget",
        quantity: 2,
        unitPriceSnapshotCents: 1000,
        currency: "NGN",
        status: "published",
        collectionId: null,
      },
    ]);
    vi.mocked(findUnpublishedCartItems).mockResolvedValue([]);
    vi.mocked(findPaymentSettings).mockResolvedValue({
      tenantId: tenant.id,
      collectionMethod: "prepaid",
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
      paymentMethod: "online",
      source: "store",
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
      lastUtmSource: null,
      lastUtmMedium: null,
      lastUtmCampaign: null,
      lastUtmTerm: null,
      lastUtmContent: null,
      lastReferrer: null,
      lastLandingPath: null,
      lastFbclid: null,
      lastTtclid: null,
      lastGclid: null,
      discountId: null,
      discountCode: null,
      discountAmountCents: 0,
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
