/**
 * Helper functions for working with form responses
 * These utilities help extract constants from field_values JSONB
 */

export interface FormResponseFieldValues {
  [key: string]: any;
  customer_name?: string;
  customer_phone?: string;
  phone_number?: string;
  whatsapp_number?: string;
  phone?: string;
  package_name?: string;
  selected_package?: string;
  package?: string;
  package_type?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  location?: string;
  delivery_address?: string;
  [key: string]: any;
}

/**
 * Extract phone number from field_values
 * Tries multiple common field names
 */
export function extractPhoneNumber(
  fieldValues: FormResponseFieldValues | null | undefined
): string | null {
  if (!fieldValues) return null;

  return (
    fieldValues.customer_phone ||
    fieldValues.phone_number ||
    fieldValues.whatsapp_number ||
    fieldValues.phone ||
    null
  );
}

/**
 * Extract package name from field_values
 * Tries multiple common field names
 */
export function extractPackageName(
  fieldValues: FormResponseFieldValues | null | undefined
): string | null {
  if (!fieldValues) return null;

  return (
    fieldValues.package_name ||
    fieldValues.selected_package ||
    fieldValues.package ||
    fieldValues.package_type ||
    null
  );
}

/**
 * Extract customer name from field_values
 * Tries multiple common field names and combinations
 */
export function extractCustomerName(
  fieldValues: FormResponseFieldValues | null | undefined
): string | null {
  if (!fieldValues) return null;

  // Try direct customer_name or name
  if (fieldValues.customer_name) return fieldValues.customer_name;
  if (fieldValues.name) return fieldValues.name;

  // Try first_name + last_name combination
  const firstName = fieldValues.first_name || "";
  const lastName = fieldValues.last_name || "";
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim() || null;
  }

  return null;
}

/**
 * Extract location from field_values
 * Tries multiple common field names
 */
export function extractLocation(
  fieldValues: FormResponseFieldValues | null | undefined
): string | null {
  if (!fieldValues) return null;

  const location = fieldValues.location;
  const address = fieldValues.address;
  const deliveryAddress = fieldValues.delivery_address;
  const state = fieldValues.state;

  if (location) return location;
  if (address) return address;
  if (deliveryAddress && state) {
    return `${deliveryAddress}, ${state}`;
  }
  if (deliveryAddress) return deliveryAddress;
  if (state) return state;

  return null;
}

/**
 * Calculate total profit from form response items
 * This is a client-side helper; the database trigger handles the actual calculation
 */
export function calculateProfitFromItems(
  items: Array<{
    total_price: number;
    total_cost: number;
    profit?: number;
  }>
): number {
  return items.reduce((total, item) => {
    // Use profit if available, otherwise calculate
    const itemProfit = item.profit ?? item.total_price - item.total_cost;
    return total + (itemProfit || 0);
  }, 0);
}

/**
 * Calculate potential profit from items (regardless of status)
 * This shows what profit would be if the order is completed
 * Used for displaying "potential profit" in pending orders
 */
export function calculatePotentialProfit(
  items: Array<{
    total_price: number;
    total_cost: number;
    profit?: number;
  }>
): number {
  // Same calculation as calculateProfitFromItems
  // But named differently to indicate it's for "potential" display
  return calculateProfitFromItems(items);
}

/**
 * Net order profit: order_revenue - FIFO cost - delivery_fee.
 * amount_paid is not included (use balanceDue for partial payments).
 */
export function orderProfit(
  orderRevenue: number,
  orderCost: number,
  deliveryFee: number | null | undefined
): number {
  return orderRevenue - orderCost - (deliveryFee ?? 0);
}

/**
 * Potential net profit for pending orders (display only; DB stores 0 until completed).
 */
export function potentialOrderProfit(
  items: Array<{
    total_price: number;
    total_cost: number;
    profit?: number;
  }>,
  deliveryFee: number | null | undefined
): number {
  return calculateProfitFromItems(items) - (deliveryFee ?? 0);
}

/**
 * Balance due when customer paid less than full price (full price - amount paid)
 */
export function balanceDue(
  orderRevenue: number,
  amountPaid: number | null | undefined
): number | null {
  if (amountPaid == null || amountPaid >= orderRevenue) return null;
  return orderRevenue - amountPaid;
}

/**
 * Check if a form response is an order (not abandoned cart)
 */
export function isOrder(responseType: string | null | undefined): boolean {
  return responseType === "order";
}

/**
 * Check if a form response is an abandoned cart
 */
export function isAbandonedCart(
  responseType: string | null | undefined
): boolean {
  return responseType === "abandoned_cart";
}

import { isDeliveredStatus } from "../constants/orderStatus";

/**
 * Check if a form response is completed / delivered (profit counts)
 */
export function isCompleted(status: string | null | undefined): boolean {
  return isDeliveredStatus(status);
}

/**
 * Check if a form response counts toward profit
 * Only completed orders count
 */
export function countsTowardProfit(
  responseType: string | null | undefined,
  status: string | null | undefined
): boolean {
  return isOrder(responseType) && isCompleted(status);
}

/**
 * Format form response for display
 */
export function formatFormResponse(response: {
  id: string;
  customer_name?: string | null;
  phone_number?: string | null;
  package_name?: string | null;
  status?: string | null;
  response_type?: string | null;
  profit?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  field_values?: FormResponseFieldValues | null;
}) {
  return {
    id: response.id,
    customerName: response.customer_name || "Unknown Customer",
    phoneNumber:
      response.phone_number ||
      extractPhoneNumber(response.field_values) ||
      "N/A",
    packageName:
      response.package_name ||
      extractPackageName(response.field_values) ||
      "N/A",
    status: response.status || "pending",
    responseType: response.response_type || "order",
    profit: response.profit || 0,
    createdAt: response.created_at,
    completedAt: response.completed_at,
    isCompleted: isCompleted(response.status),
    countsTowardProfit: countsTowardProfit(
      response.response_type,
      response.status
    ),
  };
}
