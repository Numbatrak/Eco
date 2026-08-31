import { describe, it, expect } from "vitest";
import { quoteDelivery } from "./quote.js";
import type { DeliverySettingsResponse } from "@platform/shared-types";

function settings(overrides: Partial<DeliverySettingsResponse> = {}): DeliverySettingsResponse {
  return {
    vatEnabled: false,
    vatRateBps: 0,
    deliveryFeeCents: 2500,
    freeDeliveryThresholdCents: null,
    ...overrides,
  };
}

function both(subtotalCents: number, zoneFeeCents?: number) {
  return { preDiscountSubtotalCents: subtotalCents, postDiscountSubtotalCents: subtotalCents, zoneFeeCents };
}

describe("quoteDelivery", () => {
  it("charges the flat delivery fee when there's no free-shipping threshold", () => {
    const quote = quoteDelivery(settings({ deliveryFeeCents: 2500 }), both(10000));
    expect(quote.feeCents).toBe(2500);
    expect(quote.qualifiesForFreeDelivery).toBe(false);
  });

  it("waives the fee once the subtotal meets the free-shipping threshold", () => {
    const quote = quoteDelivery(
      settings({ deliveryFeeCents: 2500, freeDeliveryThresholdCents: 10000 }),
      both(10000),
    );
    expect(quote.feeCents).toBe(0);
    expect(quote.qualifiesForFreeDelivery).toBe(true);
  });

  it("still charges the fee just under the threshold", () => {
    const quote = quoteDelivery(
      settings({ deliveryFeeCents: 2500, freeDeliveryThresholdCents: 10000 }),
      both(9999),
    );
    expect(quote.feeCents).toBe(2500);
    expect(quote.qualifiesForFreeDelivery).toBe(false);
  });

  it("returns zero VAT when VAT is disabled, regardless of rate", () => {
    const quote = quoteDelivery(settings({ vatEnabled: false, vatRateBps: 750 }), both(10000));
    expect(quote.vat.amountCents).toBe(0);
    expect(quote.vat.enabled).toBe(false);
  });

  it("computes VAT on subtotal + delivery fee when enabled", () => {
    const quote = quoteDelivery(
      settings({ vatEnabled: true, vatRateBps: 750, deliveryFeeCents: 2500 }),
      both(10000),
    );
    // (10000 + 2500) * 0.075 = 937.5 -> rounds to 938
    expect(quote.vat.amountCents).toBe(938);
  });

  it("computes zero VAT on a zero rate", () => {
    const quote = quoteDelivery(settings({ vatEnabled: true, vatRateBps: 0 }), both(10000));
    expect(quote.vat.amountCents).toBe(0);
  });

  it("uses a zone rate instead of the flat fee when provided", () => {
    const quote = quoteDelivery(settings({ deliveryFeeCents: 2500 }), both(10000, 4000));
    expect(quote.feeCents).toBe(4000);
  });

  it("checks the free-delivery threshold against the pre-discount subtotal", () => {
    const quote = quoteDelivery(
      settings({ deliveryFeeCents: 2500, freeDeliveryThresholdCents: 10000 }),
      { preDiscountSubtotalCents: 10000, postDiscountSubtotalCents: 4000 },
    );
    expect(quote.qualifiesForFreeDelivery).toBe(true);
    expect(quote.feeCents).toBe(0);
  });

  it("computes VAT on the post-discount subtotal", () => {
    const quote = quoteDelivery(
      settings({ vatEnabled: true, vatRateBps: 750, deliveryFeeCents: 2500 }),
      { preDiscountSubtotalCents: 10000, postDiscountSubtotalCents: 5000 },
    );
    // (5000 + 2500) * 0.075 = 562.5 -> rounds to 563
    expect(quote.vat.amountCents).toBe(563);
  });
});
