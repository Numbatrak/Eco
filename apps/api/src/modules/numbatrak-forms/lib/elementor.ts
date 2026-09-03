import type { NumbatrakFormFieldMapping, PublicFormLineItem } from "@platform/shared-types";

interface ElementorField {
  id?: string;
  title?: string;
  value?: unknown;
  raw_value?: unknown;
}

interface ElementorWebhookPayload {
  fields?: Record<string, ElementorField>;
}

/**
 * Elementor Pro's native Webhook action posts a flat `fields` object keyed by
 * each field's id, with the field's own id/title alongside its value - unlike
 * WPForms' Webhooks addon, the merchant can't reshape this. Flattened here
 * into a single id-or-title -> value map so a NumbatrakFormFieldMapping entry
 * can reference whichever one the merchant finds easier to read off their
 * Elementor form. Exact key names should be confirmed against a live test
 * webhook when wiring up a real form - Elementor's payload shape has drifted
 * across plugin versions.
 */
export function flattenElementorPayload(body: unknown): Record<string, string> {
  const fields = (body as ElementorWebhookPayload | null)?.fields;
  const flat: Record<string, string> = {};
  if (!fields || typeof fields !== "object") return flat;

  for (const [key, field] of Object.entries(fields)) {
    const value = field?.value ?? field?.raw_value;
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    flat[key] = text;
    if (field?.id) flat[field.id] = text;
    if (field?.title) flat[field.title] = text;
  }
  return flat;
}

/** Builds the same customer_name/phone/whatsapp/address/state keys deriveContactFields (lib/intake.ts) already reads. */
export function resolveContactFields(
  flat: Record<string, string>,
  contactFields: NumbatrakFormFieldMapping["contactFields"],
): Record<string, unknown> {
  const fieldValues: Record<string, unknown> = {};
  const assign = (canonicalKey: string, mappedFieldKey: string | undefined) => {
    if (mappedFieldKey && flat[mappedFieldKey]) fieldValues[canonicalKey] = flat[mappedFieldKey];
  };
  assign("customer_name", contactFields.customerName);
  assign("phone", contactFields.phone);
  assign("whatsapp", contactFields.whatsapp);
  assign("address", contactFields.address);
  assign("state", contactFields.state);
  return fieldValues;
}

interface RadioOptionProduct {
  product_id?: string;
  quantity?: number;
  offer_id?: string;
  variant_id?: string;
}

interface RadioOption {
  id?: string;
  products?: RadioOptionProduct[];
}

function collectRadioOptions(schema: unknown): RadioOption[] {
  const fields = (schema as { fields?: unknown[] } | null)?.fields;
  if (!Array.isArray(fields)) return [];
  const options: RadioOption[] = [];
  for (const field of fields) {
    const radioOptions = (field as { radioOptions?: RadioOption[] })?.radioOptions;
    if (Array.isArray(radioOptions)) options.push(...radioOptions);
    const orderBump = (field as { orderBump?: RadioOption })?.orderBump;
    if (orderBump) options.push(orderBump);
  }
  return options;
}

/**
 * Elementor submissions have no concept of our product IDs - the merchant's
 * field-mapping config (`valueToOptionId`) bridges a raw answer (e.g.
 * "2-Pack Bundle") to one of the form's own radioOptions, whose `products[]`
 * this converts into the same {productId, quantity, ...} shape the embed
 * widget already computes client-side. Returns [] (not an error) when
 * nothing resolves - submitFormOrder already falls back to creating an
 * abandoned cart when contact info is present but items are empty.
 */
export function resolveItems(
  flat: Record<string, string>,
  mapping: NumbatrakFormFieldMapping,
  formSchema: unknown,
): PublicFormLineItem[] {
  if (!mapping.productField) return [];
  const answer = flat[mapping.productField];
  if (!answer) return [];
  const optionId = mapping.valueToOptionId[answer];
  if (!optionId) return [];

  const option = collectRadioOptions(formSchema).find((o) => o.id === optionId);
  if (!option?.products?.length) return [];

  return option.products
    .filter((p): p is RadioOptionProduct & { product_id: string } => typeof p.product_id === "string")
    .map((p) => ({
      productId: p.product_id,
      quantity: p.quantity && p.quantity > 0 ? p.quantity : 1,
      variantId: p.variant_id ?? null,
      offerId: p.offer_id ?? null,
    }));
}
