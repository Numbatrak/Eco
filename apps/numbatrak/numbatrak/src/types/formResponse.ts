import { FormResponseFieldValues } from "../utils/formResponseHelpers";
import type { MoneyReceivedBy } from "../constants/orderAttribution";
import type { OrderStatus } from "../constants/orderStatus";

/**
 * Form Response Item - represents a product in a form response
 */
export interface FormResponseItem {
  id: string; // UUID
  form_response_id: string; // UUID
  product_id: string; // UUID
  quantity: number;

  // Price snapshots at time of form submission
  unit_price_at_submission: number;
  unit_cost_at_submission: number;

  // Calculated totals
  total_price: number;
  total_cost: number;
  profit: number;

  created_at?: string | null;
}

/**
 * Form Response - represents a form submission (order or abandoned cart)
 */
export interface FormResponse {
  id: string; // UUID — form_response id, or (greenfield) customer_order id
  /** When using `customer_orders` mirror, the original `form_responses` row (if any) */
  form_response_id?: string | null;
  organization_id: string; // UUID
  form_id: string | null; // UUID, can be null if form was deleted
  response_type: "order" | "abandoned_cart";
  status: OrderStatus | "abandoned";
  source: string; // e.g., 'wordpress'
  page_url: string | null;

  // All form field values stored as JSONB (source of truth)
  field_values: FormResponseFieldValues;

  // Selected products with quantities (from form submission)
  selected_products: Array<{
    product_id: string;
    quantity: number;
  }>;

  // EXTRACTED CONSTANTS (for easy querying and display)
  phone_number: string | null;
  package_name: string | null;
  offer_name?: string | null;
  funnel_name?: string | null;
  sub_brand?: string | null;
  money_received_by?: MoneyReceivedBy | null;
  payment_method?: "cod" | "online" | null;
  customer_name: string | null;

  // Profit calculation (only set when status = 'completed')
  profit: number;

  // Full price from items (order_revenue) and cost (order_cost) – from DB
  order_revenue: number;
  order_cost: number;

  // Amount customer actually paid / agreed to pay (e.g. after bidding). When null, full price is used.
  amount_paid: number | null;

  // Delivery fee (cost) – subtracted from profit for net profit
  delivery_fee: number | null;

  // Notes field for additional information
  notes: string | null;

  // Agent assigned to this order (optional)
  agent_id: number | null;

  /** Customer success rep (when column exists on form_responses / customer_orders) */
  csr_id?: string | null;

  // Timestamps
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;

  // Conversion tracking
  converted_from_abandoned: boolean;
  converted_response_id: string | null;
}

/**
 * Form Response with Items - includes related form_response_items
 */
export interface FormResponseWithItems extends FormResponse {
  items: FormResponseItem[];

  // Optional: Include form schema for dynamic field rendering
  form?: {
    id: string;
    name: string;
    schema?: {
      fields?: Array<{
        id: string;
        type: string;
        label: string;
        name: string;
      }>;
    };
  } | null;
}

/**
 * Form Response filters for querying
 */
export interface FormResponseFilters {
  status?: OrderStatus | "abandoned";
  response_type?: "order" | "abandoned_cart";
  form_id?: string;
  /** Customer rep (user_profiles.id) — used by greenfield `customer_orders` */
  csr_id?: string;
  agent_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  sub_brand?: string;
  funnel_name?: string;
  offer_name?: string;
}
