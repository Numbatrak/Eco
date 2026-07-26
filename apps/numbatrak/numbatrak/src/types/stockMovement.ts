export type StockMovementType =
  | "waybill_to_agent"
  | "deliver_to_customer"
  | "return_to_lagos"
  | "transfer"
  | "adjust"
  | "damaged"
  | "missing";

export type ShrinkageMovementType = "damaged" | "missing";

export interface StockMovement {
  id: string;
  organization_id: string;
  movement_type: StockMovementType;
  product_id: string;
  quantity: number;
  from_agent_id: number | null;
  to_agent_id: number | null;
  order_id: string | null;
  waybill_batch_id: string | null;
  legacy_delivery_id: number | null;
  occurred_at: string;
  cost: number;
  fee: number;
  recorded_by_user_id: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface AgentStockBreakdownRow {
  organization_id: string;
  agent_id: number;
  product_id: string;
  waybilled_in: number;
  delivered_to_customer: number;
  approx_remaining: number;
  product_name?: string;
  agent_name?: string;
}

/** Row from `agent_stock_v` — true ledger on-hand */
export interface AgentStockOnHandRow {
  organization_id: string;
  agent_id: number;
  product_id: string;
  quantity_on_hand: number;
  agent_name?: string;
  product_name?: string;
  is_warehouse?: boolean;
}

export interface StockMovementListOptions {
  limit?: number;
  product_id?: string;
  agent_id?: number;
  movement_type?: StockMovementType;
  date_from?: string;
  date_to?: string;
}
