import type { MoneyReceivedBy } from "../constants/orderAttribution";

export type PaymentMethod = "cod" | "online";

/** Legacy per-order wallet status (synced when line is remitted). */
export type WalletStatus = "pending_remittance" | "collected" | "released";

export type RemittanceLineStatus =
  | "standing"
  | "remitted"
  | "short"
  | "net_owed";

export type WalletDateFilterType =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "custom";

export interface WalletDateFilter {
  type: WalletDateFilterType;
  startDate?: string;
  endDate?: string;
}

/** Source order included in an agent-per-day remittance line. */
export interface WalletSourceOrder {
  id: string;
  source: "customer_orders" | "form_responses";
  customer_name: string | null;
  phone_number: string | null;
  agent_id: number;
  agent_name: string | null;
  order_revenue: number;
  amount_paid: number | null;
  delivery_fee: number;
  delivered_value: number;
  sub_brand: string | null;
  payment_method: PaymentMethod;
  money_received_by: MoneyReceivedBy;
  wallet_status: WalletStatus | null;
  completed_at: string | null;
}

/** Agent-per-day remittance line (spec unit). */
export interface WalletRemittanceLine {
  /** Stable client key: `${agentId}:${YYYY-MM-DD}` */
  lineKey: string;
  /** DB row id when persisted */
  id: string | null;
  organization_id: string;
  agent_id: number;
  agent_name: string;
  remittance_date: string;
  order_count: number;
  orders: WalletSourceOrder[];
  sub_brands: string[];
  total_delivered_value: number;
  total_delivery_fees: number;
  net_off_amount: number;
  expected_remittance: number;
  actual_amount: number | null;
  status: RemittanceLineStatus;
  shortfall: number;
  net_off_expense_id: string | null;
  notes: string | null;
  remitted_at: string | null;
}

export interface WalletSummary {
  lineCount: number;
  orderCount: number;
  totalDeliveredValue: number;
  totalDeliveryFees: number;
  totalExpectedRemittance: number;
  totalRemitted: number;
  /** Cash still in the field: expected − actual for open lines */
  cashGapOutstanding: number;
  standingCount: number;
  shortCount: number;
  remittedCount: number;
}

export type RemittanceStatusFilter = "all" | RemittanceLineStatus;

/** @deprecated Use WalletSourceOrder — kept for migration compatibility */
export interface WalletOrderRow {
  id: string;
  source: "customer_orders" | "form_responses";
  customer_name: string | null;
  phone_number: string | null;
  agent_id: number | null;
  agent_name: string | null;
  order_revenue: number;
  amount_paid: number | null;
  payment_method: PaymentMethod;
  money_received_by: MoneyReceivedBy;
  wallet_status: WalletStatus | null;
  completed_at: string | null;
  remittance_confirmed_at: string | null;
  released_at: string | null;
}

export type WalletStatusFilter = "all" | WalletStatus;
