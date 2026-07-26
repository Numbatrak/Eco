/**
 * Greenfield orders API (table: `customer_orders`).
 * Re-exports the canonical service — legacy `orders.ts` remains for old rows / abandoned cart bridge.
 */
export {
  fetchCustomerOrders,
  updateCustomerOrder,
  deleteCustomerOrder,
  deleteCustomerOrderDeep,
  createCustomerOrderFromAbandonedCart,
} from "./customerOrders";
