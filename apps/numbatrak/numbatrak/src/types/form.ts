// Product attachment for radio group options
export interface RadioOptionProduct {
  product_id: string;
  quantity: number;
  /** Typed offer from product_offers (drives pricing + accord rule) */
  offer_id?: string | null;
  /** Sellable variant SKU when product allows variants */
  variant_id?: string | null;
}

// Radio group option
export interface RadioOption {
  id: string;
  title: string;
  value: string;
  price: number;
  products: RadioOptionProduct[];
  /** Default offer for all lines in this package (line-level offer_id wins) */
  offer_id?: string | null;
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
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea' | 'radio-group' | 'order-bump';
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
