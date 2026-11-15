// Product attachment for radio group options
export interface RadioOptionProduct {
  product_id: string;
  quantity: number;
  /** Typed offer from product_offers (drives pricing + accord rule) */
  offer_id?: string | null;
  /** Sellable variant SKU when product allows variants */
  variant_id?: string | null;
}

/**
 * One choice in a package picker (and the shape an order bump uses too).
 *
 * Packages are defined once as product offers under Products; a form only
 * picks one. `source` records which era an option comes from:
 *  - "offer": owned by a product offer. title/price/products are mirrored from
 *    it and are read-only in the builder.
 *  - undefined (or "manual"): built by hand before packages moved to Products.
 *    Still renders and still takes orders, but is shown locked, because its
 *    shape can't be expressed as a single offer and must not be rewritten
 *    underneath a live form.
 */
export interface RadioOption {
  id: string;
  title: string;
  value: string;
  price: number;
  products: RadioOptionProduct[];
  /** Default offer for all lines in this package (line-level offer_id wins) */
  offer_id?: string | null;
  /** Where this option's definition lives. Absent on options saved before packages moved to Products. */
  source?: "offer" | "manual";
}

/** Show field only when another field equals a value */
export interface FieldShowWhen {
  fieldName: string;
  equals: string;
}

export interface FormConfirmation {
  type: 'message' | 'redirect';
  message?: string;
  redirectUrl?: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'state' | 'textarea' | 'radio-group' | 'order-bump';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{value: string, label: string}>; // For select fields
  radioOptions?: RadioOption[]; // For radio-group fields
  /** Optional upsell checkbox with attached products */
  orderBump?: RadioOption;
  /** Conditional visibility — show when controlling field equals value */
  showWhen?: FieldShowWhen;
}

export interface FormSchema {
  fields: FormField[];
  submitButton?: {
    text: string;
    loadingText?: string;
  };
  /** Post-submit thank-you message or redirect URL (supports {{field_name}} tokens) */
  confirmation?: FormConfirmation;
}

/**
 * Elementor Pro's native webhook action posts a fixed flat payload the
 * merchant can't reshape - this tells the Elementor webhook intake route how
 * to turn that into the same {fieldValues, items} shape the embed widget
 * already computes client-side (see apps/api's numbatrak-forms/lib/elementor.ts).
 * WPForms needs no equivalent: its Webhooks addon templates its own JSON body.
 */
export interface FieldMapping {
  contactFields: {
    customerName?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    state?: string;
  };
  /** Elementor field id/title holding the package/product selection. */
  productField?: string;
  /** Elementor answer value -> this form's schema.fields[].radioOptions[].id. */
  valueToOptionId: Record<string, string>;
  /** Elementor/Fluent Forms field id/title carrying a tracking-link code. */
  trackingLinkCodeField?: string;
}

export interface Form {
  id: string;
  organization_id: string;
  name: string;
  form_token: string;
  schema: FormSchema; // JSONB schema
  active: boolean;
  /** Optional sub-brand for filters and roll-ups (spec) */
  sub_brand?: string | null;
  /** Optional funnel label; defaults to form name in order intake */
  funnel_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  field_mapping: FieldMapping;
  has_webhook_secret: boolean;
}

export interface FormProduct {
  id: string;
  form_id: string;
  product_id: string;
  min_quantity: number;
  max_quantity: number | null;
  required: boolean;
  pricing_mode: 'fixed' | 'selectable';
  display_order: number;
}

export interface FormWithProducts extends Form {
  // Can add relations here if needed
}
