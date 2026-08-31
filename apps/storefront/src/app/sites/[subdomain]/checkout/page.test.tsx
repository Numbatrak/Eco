import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Cart } from "@platform/shared-types";
import CheckoutPage from "./page";
import { cartApi } from "../../../../lib/cartApi";
import { useSite } from "../../../../components/SiteProvider";

function mockSite(collectionMethod: "cod" | "prepaid" | "both"): void {
  vi.mocked(useSite).mockReturnValue({
    subdomain: "acme",
    site: { payment: { collectionMethod } } as never,
  });
}

vi.mock("../../../../components/SiteProvider", () => ({
  useSite: vi.fn(),
}));

const cartFixture: Cart = {
  id: "cart-1",
  items: [
    {
      id: "item-1",
      productId: "product-1",
      variantId: null,
      variantLabel: null,
      name: "Widget",
      quantity: 2,
      unitPriceSnapshotCents: 500,
      lineTotalCents: 1000,
    },
  ],
  subtotalCents: 1000,
  currency: "NGN",
};

vi.mock("../../../../components/CartContext", () => ({
  useCart: vi.fn(() => ({
    cart: cartFixture,
    loading: false,
    error: null,
    addItem: vi.fn(),
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("../../../../lib/cartApi", () => ({
  cartApi: {
    checkout: vi.fn(),
    getDeliveryQuote: vi.fn().mockResolvedValue({
      feeCents: 0,
      qualifiesForFreeDelivery: true,
      freeDeliveryThresholdCents: null,
      vat: { enabled: false, rateBps: 0, amountCents: 0 },
    }),
  },
}));

describe("CheckoutPage validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSite("prepaid");
  });

  it("shows validation errors for an empty form and never calls checkout", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/full name/i)).toBeInTheDocument();
    expect(vi.mocked(cartApi.checkout)).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    await user.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/^email$/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(vi.mocked(cartApi.checkout)).not.toHaveBeenCalled();
  });

  it("submits valid contact details to checkout", async () => {
    // jsdom doesn't implement real navigation - stub location.href so the
    // redirect assignment in the component doesn't log a jsdom "not implemented" error.
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    vi.mocked(cartApi.checkout).mockResolvedValue({
      orderId: "00000000-0000-0000-0000-000000000000",
      orderNumber: "ABC12345",
      checkoutUrl: "https://pay.example.com/session",
    });

    const user = userEvent.setup();
    render(<CheckoutPage />);

    await user.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await user.type(screen.getByLabelText(/delivery address/i), "1 Broad Street");
    await user.type(screen.getByLabelText(/^city$/i), "Lagos");
    await user.selectOptions(screen.getByLabelText(/^state$/i), "Lagos");
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    await screen.findByText(/redirecting to payment/i);
    expect(cartApi.checkout).toHaveBeenCalledWith(
      "acme",
      expect.objectContaining({
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        deliveryAddress: "1 Broad Street",
        deliveryCity: "Lagos",
        deliveryState: "Lagos",
      }),
    );
    expect(window.location.href).toBe("https://pay.example.com/session");

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("places a COD order directly with no payment-method choice and redirects to order status", async () => {
    mockSite("cod");
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    vi.mocked(cartApi.checkout).mockResolvedValue({
      orderId: "order-cod-1",
      orderNumber: "COD12345",
      checkoutUrl: null,
    });

    const user = userEvent.setup();
    render(<CheckoutPage />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await user.type(screen.getByLabelText(/delivery address/i), "1 Broad Street");
    await user.type(screen.getByLabelText(/^city$/i), "Lagos");
    await user.selectOptions(screen.getByLabelText(/^state$/i), "Lagos");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await screen.findByText(/placing order/i);
    expect(window.location.href).toBe("/sites/acme/order/order-cod-1/status");

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("shows a Pay on Delivery / Pay Now choice when the tenant allows both", async () => {
    mockSite("both");
    const user = userEvent.setup();
    render(<CheckoutPage />);

    expect(screen.getByLabelText(/pay on delivery/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pay now/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/pay on delivery/i));
    expect(screen.getByLabelText(/pay on delivery/i)).toBeChecked();
  });
});
