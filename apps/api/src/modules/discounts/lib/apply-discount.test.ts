import { describe, it, expect } from "vitest";
import { computeDiscount } from "./apply-discount.js";
import type { CartItemWithProductRow } from "../../cart/lib/cart-store.js";

function item(overrides: Partial<CartItemWithProductRow> = {}): CartItemWithProductRow {
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
    collectionId: null,
    ...overrides,
  };
}

describe("computeDiscount", () => {
  it("amount_off_order: applies a percentage off the subtotal", () => {
    const result = computeDiscount(
      { type: "amount_off_order", valueType: "percentage", value: 10 },
      [item()],
      10000,
    );
    expect(result).toEqual({ amountOffCents: 1000, freeShipping: false });
  });

  it("amount_off_order: caps a fixed amount at the subtotal", () => {
    const result = computeDiscount(
      { type: "amount_off_order", valueType: "fixed_amount", value: 50000 },
      [item()],
      10000,
    );
    expect(result.amountOffCents).toBe(10000);
  });

  it("amount_off_order: does nothing below the minimum subtotal", () => {
    const result = computeDiscount(
      { type: "amount_off_order", valueType: "percentage", value: 10, minimumSubtotalCents: 20000 },
      [item()],
      10000,
    );
    expect(result.amountOffCents).toBe(0);
  });

  it("amount_off_products: only discounts targeted product lines, not the whole cart", () => {
    const items = [
      item({ id: "a", productId: "target", quantity: 2, unitPriceSnapshotCents: 1000 }),
      item({ id: "b", productId: "other", quantity: 1, unitPriceSnapshotCents: 5000 }),
    ];
    const result = computeDiscount(
      {
        type: "amount_off_products",
        valueType: "percentage",
        value: 50,
        targetProductIds: ["target"],
        targetCollectionIds: [],
      },
      items,
      7000,
    );
    // 50% off the 2000 line total for the targeted product only
    expect(result.amountOffCents).toBe(1000);
  });

  it("amount_off_products: matches by collection when the product isn't directly targeted", () => {
    const items = [item({ productId: "p1", collectionId: "col-1", quantity: 1, unitPriceSnapshotCents: 4000 })];
    const result = computeDiscount(
      {
        type: "amount_off_products",
        valueType: "fixed_amount",
        value: 500,
        targetProductIds: [],
        targetCollectionIds: ["col-1"],
      },
      items,
      4000,
    );
    expect(result.amountOffCents).toBe(500);
  });

  it("buy_x_get_y: no discount when the cart doesn't have enough of the buy or get product", () => {
    const items = [item({ productId: "buy", quantity: 1 }), item({ id: "b", productId: "get", quantity: 1 })];
    const result = computeDiscount(
      { type: "buy_x_get_y", buyProductId: "buy", buyQuantity: 2, getProductId: "get", getQuantity: 1, getDiscountPercent: 100 },
      items,
      2000,
    );
    expect(result.amountOffCents).toBe(0);
  });

  it("buy_x_get_y: discounts the get-item once quantities qualify", () => {
    const items = [
      item({ id: "a", productId: "buy", quantity: 2, unitPriceSnapshotCents: 1000 }),
      item({ id: "b", productId: "get", quantity: 1, unitPriceSnapshotCents: 800 }),
    ];
    const result = computeDiscount(
      { type: "buy_x_get_y", buyProductId: "buy", buyQuantity: 2, getProductId: "get", getQuantity: 1, getDiscountPercent: 100 },
      items,
      2800,
    );
    expect(result.amountOffCents).toBe(800);
  });

  it("buy_x_get_y: a partial discount percent only discounts part of the get-item", () => {
    const items = [
      item({ id: "a", productId: "buy", quantity: 1, unitPriceSnapshotCents: 1000 }),
      item({ id: "b", productId: "get", quantity: 1, unitPriceSnapshotCents: 1000 }),
    ];
    const result = computeDiscount(
      { type: "buy_x_get_y", buyProductId: "buy", buyQuantity: 1, getProductId: "get", getQuantity: 1, getDiscountPercent: 50 },
      items,
      2000,
    );
    expect(result.amountOffCents).toBe(500);
  });

  it("free_shipping: qualifies with no minimum", () => {
    const result = computeDiscount({ type: "free_shipping" }, [item()], 1000);
    expect(result).toEqual({ amountOffCents: 0, freeShipping: true });
  });

  it("free_shipping: does not qualify below the minimum", () => {
    const result = computeDiscount({ type: "free_shipping", minimumSubtotalCents: 5000 }, [item()], 1000);
    expect(result.freeShipping).toBe(false);
  });
});
