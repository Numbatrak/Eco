import { ProductOffer } from "../types/product";
import { RadioOptionProduct } from "../types/form";

export interface FormOrderItemPayload {
  product_id: string;
  quantity: number;
  offer_id?: string;
  variant_id?: string;
}

/** Merge lines that share product + offer + variant (sum quantities) */
export function mergeFormOrderItems(
  lines: FormOrderItemPayload[]
): FormOrderItemPayload[] {
  const map = new Map<string, FormOrderItemPayload>();
  for (const line of lines) {
    const key = `${line.product_id}|${line.offer_id ?? ""}|${line.variant_id ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      map.set(key, { ...line });
    }
  }
  return Array.from(map.values());
}

/** Build RPC item from schema line + optional option-level offer fallback */
export function lineToOrderItem(
  line: RadioOptionProduct,
  optionOfferId?: string | null
): FormOrderItemPayload | null {
  if (!line.product_id) return null;
  const item: FormOrderItemPayload = {
    product_id: line.product_id,
    quantity: line.quantity > 0 ? line.quantity : 1,
  };
  const offerId = line.offer_id || optionOfferId;
  if (offerId) item.offer_id = offerId;
  if (line.variant_id) item.variant_id = line.variant_id;
  return item;
}

export function offerLabel(offer: ProductOffer): string {
  return `${offer.label} (${offer.offer_type.replace(/_/g, " ")}) — ₦${offer.price.toLocaleString("en-NG")}`;
}

export function offersForProduct(
  offersByProduct: Record<string, ProductOffer[]>,
  productId: string
): ProductOffer[] {
  return (offersByProduct[productId] ?? []).filter((o) => o.active);
}

/** Offers available for a radio option (union across attached products) */
export function offersForRadioOption(
  products: RadioOptionProduct[],
  offersByProduct: Record<string, ProductOffer[]>
): ProductOffer[] {
  const seen = new Set<string>();
  const result: ProductOffer[] = [];
  for (const line of products) {
    if (!line.product_id) continue;
    for (const offer of offersForProduct(offersByProduct, line.product_id)) {
      if (!seen.has(offer.id)) {
        seen.add(offer.id);
        result.push(offer);
      }
    }
  }
  return result;
}
