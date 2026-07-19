import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Cart } from "@platform/shared-types";
import { MiniCart } from "./MiniCart";
import { CartProvider } from "./CartContext";
import { cartApi } from "../lib/cartApi";

vi.mock("../lib/cartApi", () => ({
  cartApi: {
    createCart: vi.fn(),
    getCart: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    checkout: vi.fn(),
    getOrderStatus: vi.fn(),
  },
}));

function makeCart(quantity: number): Cart {
  return {
    id: "cart-1",
    items: [
      {
        id: "item-1",
        productId: "product-1",
        variantId: null,
        variantLabel: null,
        name: "Widget",
        quantity,
        unitPriceSnapshotCents: 500,
        lineTotalCents: 500 * quantity,
      },
    ],
    subtotalCents: 500 * quantity,
    currency: "NGN",
  };
}

async function renderOpenCart(initialQuantity: number) {
  vi.mocked(cartApi.getCart).mockResolvedValue(makeCart(initialQuantity));

  const user = userEvent.setup();
  render(
    <CartProvider subdomain="acme">
      <MiniCart />
    </CartProvider>,
  );

  await user.click(screen.getByRole("button", { name: /open cart/i }));
  await screen.findByText("Widget");
  return user;
}

describe("MiniCart quantity updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increases quantity via the + button", async () => {
    vi.mocked(cartApi.updateItem).mockResolvedValue(makeCart(3));
    const user = await renderOpenCart(2);

    await user.click(screen.getByRole("button", { name: /increase quantity of widget/i }));

    expect(cartApi.updateItem).toHaveBeenCalledWith("acme", "item-1", { quantity: 3 });
    expect(cartApi.removeItem).not.toHaveBeenCalled();
  });

  it("decreases quantity via the − button when quantity is above 1", async () => {
    vi.mocked(cartApi.updateItem).mockResolvedValue(makeCart(1));
    const user = await renderOpenCart(2);

    await user.click(screen.getByRole("button", { name: /decrease quantity of widget/i }));

    expect(cartApi.updateItem).toHaveBeenCalledWith("acme", "item-1", { quantity: 1 });
    expect(cartApi.removeItem).not.toHaveBeenCalled();
  });

  it("removes the item instead of decrementing below 1", async () => {
    vi.mocked(cartApi.removeItem).mockResolvedValue({ id: "cart-1", items: [], subtotalCents: 0, currency: null });
    const user = await renderOpenCart(1);

    await user.click(screen.getByRole("button", { name: /decrease quantity of widget/i }));

    expect(cartApi.removeItem).toHaveBeenCalledWith("acme", "item-1");
    expect(cartApi.updateItem).not.toHaveBeenCalled();
  });
});
