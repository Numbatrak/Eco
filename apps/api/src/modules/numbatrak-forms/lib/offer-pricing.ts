import { and, eq, isNull, sql } from "drizzle-orm";
import {
  numbatrakProductOffers,
  numbatrakProductPriceHistory,
  numbatrakProductVariants,
  numbatrakProducts,
  type Queryable,
} from "@platform/db";
import { consumeFifoLots } from "./inventory-consumption.js";

export interface BundleComponentSpec {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ResolvedLinePricing {
  variantId: string | null;
  quantityPaid: number;
  freeQuantity: number;
  trueUnitCount: number;
  unitPrice: number;
  unitCost: number;
  /** Non-null only for a "bundle"-type offer - the other products this offer bundles in, per-unit quantities. */
  bundleItems: BundleComponentSpec[] | null;
}

/**
 * Verbatim TS port of create_order_from_normalized_submission's per-line
 * pricing resolution (packages/db's Phase-1 migration notes point at
 * 20260720230000_order_assignment_stabilization.sql as the final,
 * authoritative version - two earlier redefinitions exist but omit the CSR
 * auto-assignment layer, a trap already flagged by the research pass on
 * this slice). "quantity" from the caller is the raw line quantity for
 * plain/variant lines, but the BUNDLE COUNT for typed offers - the RPC
 * itself derives quantityPaid/freeQuantity/trueUnitCount from it, the
 * caller never sends those directly (confirmed against the Edge Function's
 * own OrderItemInput type, which only carries product_id/quantity/variant_id/offer_id).
 */
export async function resolveLinePricing(
  db: Queryable,
  organizationId: string,
  productId: string,
  quantity: number,
  variantId: string | null,
  offerId: string | null,
): Promise<ResolvedLinePricing> {
  if (offerId) {
    const [offer] = await db
      .select()
      .from(numbatrakProductOffers)
      .where(
        and(
          eq(numbatrakProductOffers.id, offerId),
          eq(numbatrakProductOffers.organizationId, organizationId),
          eq(numbatrakProductOffers.productId, productId),
          eq(numbatrakProductOffers.active, true),
        ),
      )
      .limit(1);
    if (!offer) throw new Error(`Offer not found, inactive, or doesn't match product ${productId}`);

    const now = new Date();
    if (offer.startsAt && offer.startsAt > now) throw new Error(`Offer ${offerId} has not started yet`);
    if (offer.endsAt && offer.endsAt < now) throw new Error(`Offer ${offerId} has expired`);

    const price = Number(offer.price);
    const unitCost = Number(offer.unitCost);
    let quantityPaid: number;
    let freeQuantity: number;
    let unitPrice: number;

    switch (offer.offerType) {
      case "buy_x_get_y":
        quantityPaid = quantity * offer.minQuantity;
        freeQuantity = quantity * offer.freeQuantity;
        unitPrice = price / offer.minQuantity;
        break;
      case "quantity_tier":
        quantityPaid = quantity;
        freeQuantity = 0;
        unitPrice = price / Math.max(offer.minQuantity, 1);
        break;
      case "bundle":
        quantityPaid = quantity;
        freeQuantity = 0;
        unitPrice = price;
        break;
      default: // "single"
        quantityPaid = quantity;
        freeQuantity = 0;
        unitPrice = price;
        break;
    }

    return {
      // An offer can force a specific variant regardless of what the line requested.
      variantId: offer.variantId ?? variantId,
      quantityPaid,
      freeQuantity,
      trueUnitCount: quantityPaid + freeQuantity,
      unitPrice,
      unitCost,
      bundleItems: offer.offerType === "bundle" ? (offer.bundleItems as BundleComponentSpec[] | null) : null,
    };
  }

  if (variantId) {
    const [variant] = await db
      .select()
      .from(numbatrakProductVariants)
      .where(
        and(
          eq(numbatrakProductVariants.id, variantId),
          eq(numbatrakProductVariants.organizationId, organizationId),
          eq(numbatrakProductVariants.productId, productId),
          eq(numbatrakProductVariants.active, true),
        ),
      )
      .limit(1);
    if (!variant) throw new Error(`Variant not found, inactive, or doesn't match product ${productId}`);

    return {
      variantId,
      quantityPaid: quantity,
      freeQuantity: 0,
      trueUnitCount: quantity,
      unitPrice: Number(variant.basePrice),
      unitCost: Number(variant.costPrice),
      bundleItems: null,
    };
  }

  // Plain product: current open-ended price_history row, else product's own base/cost price.
  const [priceRow] = await db
    .select({ price: numbatrakProductPriceHistory.price, costPrice: numbatrakProductPriceHistory.costPrice })
    .from(numbatrakProductPriceHistory)
    .where(and(eq(numbatrakProductPriceHistory.productId, productId), isNull(numbatrakProductPriceHistory.endsAt)))
    .orderBy(sql`${numbatrakProductPriceHistory.startsAt} desc`)
    .limit(1);

  if (priceRow) {
    return {
      variantId: null,
      quantityPaid: quantity,
      freeQuantity: 0,
      trueUnitCount: quantity,
      unitPrice: Number(priceRow.price),
      unitCost: Number(priceRow.costPrice),
      bundleItems: null,
    };
  }

  // No open-ended price_history row - fall back to the product's own base/cost price.
  const [product] = await db
    .select({ basePrice: numbatrakProducts.basePrice, costPrice: numbatrakProducts.costPrice })
    .from(numbatrakProducts)
    .where(eq(numbatrakProducts.id, productId))
    .limit(1);
  if (!product) throw new Error(`Product ${productId} not found while resolving price`);

  return {
    variantId: null,
    quantityPaid: quantity,
    freeQuantity: 0,
    trueUnitCount: quantity,
    unitPrice: Number(product.basePrice),
    unitCost: Number(product.costPrice),
    bundleItems: null,
  };
}

export interface BundleComponentLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

/**
 * Expands a bundle offer's other component products into inventory-only
 * order lines - each deducts its own stock (via consumeFifoLots, same as
 * any other line) and contributes to COGS, but carries zero price/revenue
 * since the bundle's single price already lives on the primary line.
 * `orderedQuantity` is the number of bundle units ordered (the same
 * `quantity` passed into resolveLinePricing for the primary line) - each
 * component's own per-bundle quantity is multiplied by this.
 */
export async function resolveBundleComponentLines(
  tx: Queryable,
  organizationId: string,
  bundleItems: BundleComponentSpec[],
  orderedQuantity: number,
): Promise<BundleComponentLine[]> {
  const lines: BundleComponentLine[] = [];

  for (const component of bundleItems) {
    const totalQuantity = component.quantity * orderedQuantity;
    if (totalQuantity <= 0) continue;
    const variantId = component.variantId ?? null;

    const consumption = await consumeFifoLots(tx, organizationId, component.productId, variantId, totalQuantity);

    let unitCost: number;
    let totalCost: number;
    if (consumption) {
      totalCost = consumption.totalCost;
      unitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    } else {
      // No lots tracked for this component - fall back to its own flat cost price.
      const costSource = variantId
        ? await tx
            .select({ costPrice: numbatrakProductVariants.costPrice })
            .from(numbatrakProductVariants)
            .where(eq(numbatrakProductVariants.id, variantId))
            .limit(1)
        : await tx
            .select({ costPrice: numbatrakProducts.costPrice })
            .from(numbatrakProducts)
            .where(eq(numbatrakProducts.id, component.productId))
            .limit(1);
      unitCost = Number(costSource[0]?.costPrice ?? 0);
      totalCost = unitCost * totalQuantity;
    }

    lines.push({
      productId: component.productId,
      variantId,
      quantity: totalQuantity,
      unitCost,
      totalCost,
    });
  }

  return lines;
}
