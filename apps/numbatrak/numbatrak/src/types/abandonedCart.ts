export interface AbandonedCart {
  id: string;
  organization_id: string;
  /** Source form, when the cart is tied to a builder form */
  form_id?: string | null;
  customer_name: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  delivery_address: string | null;
  state: string | null;
  location: string | null;
  selected_package: string | null;
  selected_items: string | null;
  product_name: string | null;
  mail_quan: number | null;
  agent_quan: number | null;
  quantity: number | null;
  product2: string | null;
  mail_quan2: number | null;
  agent_quan2: number | null;
  quantity2: number | null;
  sales_price: number | null;
  cost_price: number | null;
  delivery_fee: number | null;
  profit: number | null;
  page_url: string | null;
  filled_fields_count: number;
  filled_fields?: string[] | null;
  field_values?: Record<string, unknown> | null;
  selected_products?: unknown[] | null;
  abandoned_at: string;
  converted_to_order: boolean;
  converted_order_id: string | null;
  funnel_name?: string | null;
  offer_name?: string | null;
  sub_brand?: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AbandonedCartWithRelations extends AbandonedCart {
  // Can add relations here if needed
}
