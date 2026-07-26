export type FollowUpStatus =
  | "awaiting"
  | "followed_up"
  | "resolved"
  | "cancelled";

export type FollowUpPriority = "low" | "medium" | "high" | "urgent";

/** Primary resolved outcomes per spec; legacy values retained for read compat. */
export type FollowUpOutcome =
  | "converted"
  | "not_converted"
  | "not_interested"
  | "follow_up_needed"
  | "resolved"
  | "other";

export interface FollowUp {
  id: number;
  order_id: string | null;
  abandoned_cart_id: string | null;
  assigned_to: string | null; // UUID of user
  status: FollowUpStatus;
  priority: FollowUpPriority;
  started_at: string | null;
  first_contact_at: string | null;
  completed_at: string | null;
  response_time_minutes: number | null; // Work hours: cart/order landing → first contact
  resolution_time_minutes: number | null; // Work hours: first action → resolved
  outcome: FollowUpOutcome | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FollowUpWithRelations extends FollowUp {
  assigned_user_name?: string | null;
  assigned_user_email?: string | null;
  order_customer_name?: string | null;
  order_customer_phone?: string | null;
  order_customer_location?: string | null;
  cart_customer_name?: string | null;
  cart_customer_phone?: string | null;
  cart_customer_whatsapp?: string | null;
  cart_customer_location?: string | null;
  cart_customer_address?: string | null;
  cart_customer_state?: string | null;
}

export interface FollowUpMetrics {
  rep_id: string;
  rep_name: string;
  rep_email: string;
  total_follow_ups: number;
  awaiting_count: number;
  followed_up_count: number;
  resolved_count: number;
  cancelled_count: number;
  avg_response_time_minutes: number | null;
  avg_resolution_time_minutes: number | null;
  conversion_rate: number;
  sla_compliance_rate: number;
  customers_responded_to?: number;
}

export interface FollowUpAnalytics {
  total_follow_ups: number;
  awaiting_count: number;
  followed_up_count: number;
  resolved_count: number;
  cancelled_count: number;
  overall_avg_response_time_minutes: number | null;
  overall_avg_resolution_time_minutes: number | null;
  overall_sla_compliance_rate: number;
  rep_metrics: FollowUpMetrics[];
  response_time_trends: {
    date: string;
    avg_response_time_minutes: number | null;
    count: number;
  }[];
}
