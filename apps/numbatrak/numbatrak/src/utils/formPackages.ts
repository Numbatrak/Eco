/**
 * Packages: the bridge between a product's offers and a form's package picker.
 *
 * A package shown on an order form is always a product offer - merchants build
 * offers once under Products (single / quantity tier / bundle / buy X get Y)
 * and forms only ever *choose* one. Previously a form option was assembled by
 * hand (a typed title, a typed price, a drawer of attached products), so the
 * same package could exist twice with two different prices and nothing
 * reconciled them.
 *
 * The option still stores a `products[]` line, because that is what every
 * intake path already reads - the embed widget, the Elementor webhook mapper
 * (apps/api .../lib/elementor.ts) and the public form's product collector. So
 * linking an option to an offer needs no server change at all; it just fills
 * that line in from the offer instead of from the merchant.
 *
 * The one real trap is line quantity. `resolveLinePricing` derives units from
 * the line quantity differently per offer type - see `offerLineQuantity`.
 */

import {
  Product,
  ProductOffer,
  ProductVariant,
  ProductOfferBundleItem,
} from "../types/product";
import { RadioOption, RadioOptionProduct } from "../types/form";
import { createId } from "./formSchemaUtils";

/**
 * Line quantity that buys exactly ONE of this package.
 *
 * Mirrors apps/api .../lib/offer-pricing.ts `resolveLinePricing`:
 *  - quantity_tier takes `quantityPaid = quantity` and prices each unit at
 *    `price / min_quantity`, so selling the "2 for N18,000" rung means sending
 *    quantity 2. Sending 1 would charge N9,000 and ship a single unit.
 *  - every other type treats the line quantity as a *bundle count*, so 1 is
 *    one package.
 */
export function offerLineQuantity(offer: ProductOffer): number {
  return offer.offer_type === "quantity_tier" ? Math.max(offer.min_quantity, 1) : 1;
}

/** Physical units one package moves, free items included (the "accord rule"). */
export function offerTrueUnitCount(offer: ProductOffer): number {
  switch (offer.offer_type) {
    case "quantity_tier":
      return Math.max(offer.min_quantity, 1);
    case "buy_x_get_y":
      return Math.max(offer.min_quantity, 1) + Math.max(offer.free_quantity, 0);
    default:
      return 1;
  }
}

/** What a customer pays for one package. Same for every type, by construction. */
export function offerPackagePrice(offer: ProductOffer): number {
  return offer.price;
}

function costOf(
  productId: string,
  variantId: string | null | undefined,
  productsById: Map<string, Product>,
  variantsById: Map<string, ProductVariant>,
): number {
  if (variantId) {
    const variant = variantsById.get(variantId);
    if (variant) return variant.cost_price ?? 0;
  }
  return productsById.get(productId)?.cost_price ?? 0;
}

/**
 * Best-effort cost of one package.
 *
 * Deliberately an estimate: at order time the server costs each component from
 * FIFO stock lots (`consumeFifoLots`) and only falls back to these flat cost
 * prices when a product has no lots. The UI must say "estimate" rather than
 * imply this is what the margin will be.
 */
export function estimateOfferCost(
  offer: ProductOffer,
  productsById: Map<string, Product>,
  variantsById: Map<string, ProductVariant>,
): number {
  const anchor = (offer.unit_cost ?? 0) * offerTrueUnitCount(offer);
  if (offer.offer_type !== "bundle") return anchor;

  const components = offer.bundle_items ?? [];
  const extra = components.reduce(
    (sum, item) =>
      sum + item.quantity * costOf(item.product_id, item.variant_id, productsById, variantsById),
    0,
  );
  return anchor + extra;
}

function unitLabel(
  productId: string,
  variantId: string | null | undefined,
  quantity: number,
  productsById: Map<string, Product>,
  variantsById: Map<string, ProductVariant>,
): string {
  const product = productsById.get(productId);
  const variant = variantId ? variantsById.get(variantId) : null;
  const name = product?.name ?? "Unknown product";
  return `${quantity}× ${name}${variant ? ` (${variant.name})` : ""}`;
}

/** Plain-language summary of what one package contains. */
export function describeOfferContents(
  offer: ProductOffer,
  productsById: Map<string, Product>,
  variantsById: Map<string, ProductVariant>,
): string {
  const anchorQty =
    offer.offer_type === "quantity_tier" || offer.offer_type === "buy_x_get_y"
      ? Math.max(offer.min_quantity, 1)
      : 1;

  const parts = [unitLabel(offer.product_id, offer.variant_id, anchorQty, productsById, variantsById)];

  if (offer.offer_type === "buy_x_get_y" && offer.free_quantity > 0) {
    parts[0] += `, +${offer.free_quantity} free`;
  }

  if (offer.offer_type === "bundle") {
    for (const item of offer.bundle_items ?? []) {
      parts.push(unitLabel(item.product_id, item.variant_id, item.quantity, productsById, variantsById));
    }
  }

  return parts.join(" + ");
}

export interface PackageChoice {
  offer: ProductOffer;
  /** The product this offer hangs off - offers are always anchored to one. */
  productName: string;
  label: string;
  price: number;
  lineQuantity: number;
  estimatedCost: number;
  estimatedProfit: number;
  contents: string;
  /** Non-null when something this package needs is missing or switched off. */
  unavailableReason: string | null;
}

export interface PackageCatalog {
  choices: PackageChoice[];
  byOfferId: Map<string, PackageChoice>;
}

/**
 * Every active offer in the catalog, as a pickable package.
 *
 * Built from data the builder already loads, so adding the picker costs no
 * extra request.
 */
export function buildPackageCatalog(
  products: Product[],
  offersByProduct: Record<string, ProductOffer[]>,
  variantsByProduct: Record<string, ProductVariant[]>,
): PackageCatalog {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const variantsById = new Map<string, ProductVariant>();
  for (const list of Object.values(variantsByProduct)) {
    for (const variant of list) variantsById.set(variant.id, variant);
  }

  const choices: PackageChoice[] = [];
  for (const list of Object.values(offersByProduct)) {
    for (const offer of list) {
      if (!offer.active) continue;
      choices.push(
        describePackage(offer, productsById, variantsById),
      );
    }
  }

  // Group by product, then by the merchant's own ordering within a product.
  choices.sort(
    (a, b) =>
      a.productName.localeCompare(b.productName) ||
      a.offer.display_order - b.offer.display_order ||
      a.label.localeCompare(b.label),
  );

  return { choices, byOfferId: new Map(choices.map((c) => [c.offer.id, c])) };
}

/** Describe one offer as a package, including why it might not be sellable. */
export function describePackage(
  offer: ProductOffer,
  productsById: Map<string, Product>,
  variantsById: Map<string, ProductVariant>,
): PackageChoice {
  const anchorProduct = productsById.get(offer.product_id);
  const price = offerPackagePrice(offer);
  const estimatedCost = estimateOfferCost(offer, productsById, variantsById);

  const missing: string[] = [];
  if (!anchorProduct) missing.push("its product is no longer available");
  if (!offer.active) missing.push("it has been switched off");
  for (const item of offer.bundle_items ?? []) {
    if (!productsById.has(item.product_id)) {
      missing.push("one of the products it bundles is no longer available");
      break;
    }
  }

  return {
    offer,
    productName: anchorProduct?.name ?? "Unknown product",
    label: offer.label,
    price,
    lineQuantity: offerLineQuantity(offer),
    estimatedCost,
    estimatedProfit: price - estimatedCost,
    contents: describeOfferContents(offer, productsById, variantsById),
    unavailableReason: missing.length > 0 ? `This package can't be sold because ${missing[0]}.` : null,
  };
}

/**
 * The single order line an offer-backed option submits.
 *
 * One line is enough for every offer type: the server expands a bundle's other
 * components itself (`resolveBundleComponentLines`) and derives free units from
 * the offer, so the form never has to spell them out.
 */
export function packageLine(choice: PackageChoice): RadioOptionProduct {
  return {
    product_id: choice.offer.product_id,
    quantity: choice.lineQuantity,
    offer_id: choice.offer.id,
    variant_id: choice.offer.variant_id ?? null,
  };
}

/**
 * True when this option is owned by a product offer.
 *
 * Options saved before packages moved to Products carry no `source`. They are
 * treated as hand-built and shown locked, because their shape - several
 * products plus an optional option-level offer, with a typed price - can't be
 * expressed as one offer and must not be silently rewritten.
 */
export function isOfferBackedOption(option: Pick<RadioOption, "source">): boolean {
  return option.source === "offer";
}

/** A brand-new, not-yet-chosen package slot. */
export function createEmptyPackageOption(value: string): RadioOption {
  return {
    id: createId("option"),
    source: "offer",
    title: "",
    value,
    price: 0,
    products: [],
    offer_id: null,
  };
}

/**
 * Point an option at a package.
 *
 * `id` and `value` are deliberately preserved: `value` is what a submission
 * carries and what the Elementor mapping keys on, and `id` is what
 * `valueToOptionId` points at. Changing either would break a live form.
 */
export function applyPackageToOption(option: RadioOption, choice: PackageChoice): RadioOption {
  return {
    ...option,
    source: "offer",
    title: choice.label,
    price: choice.price,
    offer_id: choice.offer.id,
    products: [packageLine(choice)],
  };
}

export type { ProductOfferBundleItem };
