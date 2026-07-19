import { describe, it, expect } from "vitest";
import { buildCartSummary, type CartItemWithProductRow } from "./cart-store.js";

function row(overrides: Partial<CartItemWithProductRow> = {}): CartItemWithProductRow {
  return {
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
    ...overrides,
  };
}

describe("buildCartSummary", () => {
  it("computes line totals and a subtotal from integer cents", () => {
    const summary = buildCartSummary("cart-1", [
      row({ id: "a", quantity: 2, unitPriceSnapshotCents: 1500 }),
      row({ id: "b", quantity: 3, unitPriceSnapshotCents: 799 }),
    ]);

    expect(summary.items).toHaveLength(2);
    expect(summary.items[0]).toMatchObject({
      quantity: 2,
      unitPriceSnapshotCents: 1500,
      lineTotalCents: 3000,
    });
    expect(summary.items[1]).toMatchObject({
      quantity: 3,
      unitPriceSnapshotCents: 799,
      lineTotalCents: 2397,
    });
    expect(summary.subtotalCents).toBe(3000 + 2397);
    expect(Number.isInteger(summary.subtotalCents)).toBe(true);
  });

  it("uses the price snapshot captured at add-to-cart time, not a hypothetical live price", () => {
    // unitPriceSnapshotCents deliberately differs from what a "current" product price might be -
    // buildCartSummary must only ever look at the snapshot.
    const summary = buildCartSummary("cart-1", [
      row({ unitPriceSnapshotCents: 2500, quantity: 1 }),
    ]);
    expect(summary.subtotalCents).toBe(2500);
  });

  it("returns a zero subtotal and null currency for an empty cart", () => {
    const summary = buildCartSummary("cart-1", []);
    expect(summary.items).toEqual([]);
    expect(summary.subtotalCents).toBe(0);
    expect(summary.currency).toBeNull();
  });

  it("takes the currency from the cart's items", () => {
    const summary = buildCartSummary("cart-1", [row({ currency: "GHS" })]);
    expect(summary.currency).toBe("GHS");
  });
});
