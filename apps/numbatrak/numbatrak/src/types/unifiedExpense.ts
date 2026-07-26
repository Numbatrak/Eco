export type UnifiedExpenseScope = "org" | "agent";

export type ExpenseSourceType =
  | "manual"
  | "waybill_fee"
  | "failed_delivery"
  | "wallet_net_off";

export interface UnifiedExpense {
  id: string;
  organization_id: string;
  scope: UnifiedExpenseScope;
  category: string;
  subcategory: string;
  amount: number;
  agent_id: number | null;
  product_id: string | null;
  order_id: string | null;
  note: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string | null;
  source_type?: ExpenseSourceType;
  source_id?: string | null;
  offer_name?: string | null;
  platform?: string | null;
}

export interface UnifiedExpenseWithRelations extends UnifiedExpense {
  agent?: { id: number; name: string } | null;
  product?: { id: string; name: string } | null;
}
