import type { MoneyReceivedBy } from "../constants/orderAttribution";

import type { OrderStatus } from "../constants/orderStatus";

/**
 * Greenfield order model (table: customer_orders)
 */
export type CustomerOrderStatus = OrderStatus;
export type CustomerOrderSource = "form" | "manual" | "converted_from_cart";

export interface CustomerOrder {
  id: string;
  organization_id: string;
  form_response_id: string | null;
  form_id: string | null;
  csr_id: string | null;
  agent_id: number | null;
  status: CustomerOrderStatus;
  source: CustomerOrderSource;
  customer_name: string | null;
  phone_number: string | null;
  state: string | null;
  delivery_address: string | null;
  order_revenue: number | null;
  order_cost: number | null;
  amount_paid: number | null;
  delivery_fee: number | null;
  profit: number | null;
  notes: string | null;
  abandoned_cart_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  /** Sellable package / offer selected on the funnel (spec attribution) */
  offer_name: string | null;
  /** Funnel or order-form name at submission time */
  funnel_name: string | null;
  /** Sub-brand tag copied from form or set on manual entry */
  sub_brand: string | null;
  /** Who received payment — drives Wallet remittance (spec) */
  money_received_by: MoneyReceivedBy;
  payment_method?: "cod" | "online" | null;
  wallet_status?: string | null;
}

export interface CustomerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_at_submission: number;
  unit_cost_at_submission: number;
  total_price: number;
  total_cost: number;
  profit: number;
  created_at: string | null;
}

export interface CustomerOrderWithRelations extends CustomerOrder {
  items: CustomerOrderItem[];
  csr?: { id: string; full_name: string | null; email: string | null } | null;
  form?: { id: string; name: string } | null;
  agent?: { id: number; name: string } | null;
  productNames?: Record<string, string>;
}

export interface CustomerOrderFilters {
  search?: string;
  status?: CustomerOrderStatus;
  form_id?: string;
  csr_id?: string;
  agent_id?: number;
  date_from?: string;
  date_to?: string;
  sub_brand?: string;
  funnel_name?: string;
  offer_name?: string;
}
