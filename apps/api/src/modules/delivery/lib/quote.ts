import type { DeliveryQuoteResponse, DeliverySettingsResponse } from "@platform/shared-types";

export interface QuoteDeliveryParams {
  // Free-delivery threshold is checked against the pre-discount subtotal -
  // simpler and non-exploitable (a discount can't be stacked to also unlock
  // free delivery it otherwise wouldn't qualify for).
  preDiscountSubtotalCents: number;
  // VAT is computed on the discounted subtotal - it reflects true booked
  // revenue, matching how the discount actually reduces what's collected.
  postDiscountSubtotalCents: number;
  // A matched delivery-zone rate overrides the tenant's flat fee; a
  // free-shipping discount passes 0 here to zero the fee outright.
  zoneFeeCents?: number;
}

/**
 * Pure calculation, split out from the DB fetch so it's unit-testable and so
 * checkout can call the exact same function the /delivery-quote preview
 * endpoint uses - the browser's quote is never authoritative (Pattern 8).
 */
export function quoteDelivery(settings: DeliverySettingsResponse, params: QuoteDeliveryParams): DeliveryQuoteResponse {
  const { preDiscountSubtotalCents, postDiscountSubtotalCents, zoneFeeCents } = params;
  const qualifiesForFreeDelivery =
    settings.freeDeliveryThresholdCents != null && preDiscountSubtotalCents >= settings.freeDeliveryThresholdCents;
  const feeCents = qualifiesForFreeDelivery ? 0 : (zoneFeeCents ?? settings.deliveryFeeCents);
  const amountCents = settings.vatEnabled
    ? Math.round(((postDiscountSubtotalCents + feeCents) * settings.vatRateBps) / 10000)
    : 0;

  return {
    feeCents,
    qualifiesForFreeDelivery,
    freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
    vat: {
      enabled: settings.vatEnabled,
      rateBps: settings.vatRateBps,
      amountCents,
    },
  };
}
