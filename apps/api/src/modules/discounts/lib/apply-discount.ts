import type { DiscountConfig } from "@platform/shared-types";
import type { CartItemWithProductRow } from "../../cart/lib/cart-store.js";

export interface DiscountComputation {
  amountOffCents: number;
  freeShipping: boolean;
}

/**
 * Pure - no DB access - so it's unit-testable and reusable between the
 * checkout preview route and the real checkout charge (same "never trust the
 * browser" pattern as quoteDelivery).
 */
export function computeDiscount(
  config: DiscountConfig,
  cartItems: CartItemWithProductRow[],
  subtotalCents: number,
): DiscountComputation {
  switch (config.type) {
    case "amount_off_products": {
      const targetedItems = cartItems.filter(
        (item) =>
          config.targetProductIds.includes(item.productId) ||
          (item.collectionId != null && config.targetCollectionIds.includes(item.collectionId)),
      );
      const amountOffCents = targetedItems.reduce((sum, item) => {
        const lineTotalCents = item.quantity * item.unitPriceSnapshotCents;
        const off =
          config.valueType === "percentage"
            ? Math.round((lineTotalCents * config.value) / 100)
            : Math.min(Math.round(config.value * item.quantity), lineTotalCents);
        return sum + off;
      }, 0);
      return { amountOffCents, freeShipping: false };
    }

    case "buy_x_get_y": {
      const buyItem = cartItems.find((item) => item.productId === config.buyProductId);
      const getItem = cartItems.find((item) => item.productId === config.getProductId);
      const qualifies =
        (buyItem?.quantity ?? 0) >= config.buyQuantity && (getItem?.quantity ?? 0) >= config.getQuantity;
      if (!qualifies || !getItem) {
        return { amountOffCents: 0, freeShipping: false };
      }
      const amountOffCents = Math.round(
        (getItem.unitPriceSnapshotCents * config.getQuantity * config.getDiscountPercent) / 100,
      );
      return { amountOffCents, freeShipping: false };
    }

    case "amount_off_order": {
      if (config.minimumSubtotalCents != null && subtotalCents < config.minimumSubtotalCents) {
        return { amountOffCents: 0, freeShipping: false };
      }
      const amountOffCents =
        config.valueType === "percentage"
          ? Math.round((subtotalCents * config.value) / 100)
          : Math.min(Math.round(config.value), subtotalCents);
      return { amountOffCents, freeShipping: false };
    }

    case "free_shipping": {
      const qualifies = config.minimumSubtotalCents == null || subtotalCents >= config.minimumSubtotalCents;
      return { amountOffCents: 0, freeShipping: qualifies };
    }
  }
}
