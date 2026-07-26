/**
 * Canonical v2 order API (Supabase `customer_orders` + `customer_order_items`).
 * Legacy: `src/services/orders.ts` and order rows in `form_responses`.
 */
export * from "./ordersV2";
export type { CustomerOrder } from "../types/customerOrder";
