import type { DeliveryQuoteResponse, DeliverySettingsResponse } from "@platform/shared-types";

/**
 * Pure calculation, split out from the DB fetch so it's unit-testable and so
 * checkout can call the exact same function the /delivery-quote preview
 * endpoint uses - the browser's quote is never authoritative (Pattern 8).
 */
export function quoteDelivery(
  settings: DeliverySettingsResponse,
  subtotalCents: number,
): DeliveryQuoteResponse {
  const qualifiesForFreeDelivery =
    settings.freeDeliveryThresholdCents != null && subtotalCents >= settings.freeDeliveryThresholdCents;
  const feeCents = qualifiesForFreeDelivery ? 0 : settings.deliveryFeeCents;
  const amountCents = settings.vatEnabled
    ? Math.round(((subtotalCents + feeCents) * settings.vatRateBps) / 10000)
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
