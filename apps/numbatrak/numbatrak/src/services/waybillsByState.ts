"use client";

import { apiRequest } from "../lib/apiClient";

/**
 * Waybill statistics by state/region
 */
export interface WaybillByState {
  state: string;
  totalQuantity: number;
  totalCost: number;
  waybillCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  averageDaysSinceWaybill: number | null;
}

/**
 * Get waybill statistics grouped by state/region. Filters waybilled items by
 * agent location (excluding Lagos, the central warehouse).
 *
 * @param startDate Optional start date filter (YYYY-MM-DD)
 * @param endDate Optional end date filter (YYYY-MM-DD)
 * @param stateFilter Optional state filter (if provided, only returns that state)
 */
export async function fetchWaybillsByState(
  organizationId: string | null,
  startDate?: string,
  endDate?: string,
  stateFilter?: string
): Promise<WaybillByState[]> {
  if (!organizationId) return [];

  const params = new URLSearchParams();
  if (startDate) params.set("dateFrom", startDate);
  if (endDate) params.set("dateTo", endDate);
  if (stateFilter) params.set("state", stateFilter);

  const { states } = await apiRequest<{ states: WaybillByState[] }>(
    `/org/numbatrak/deliveries/waybills-by-state?${params.toString()}`
  );
  return states;
}
