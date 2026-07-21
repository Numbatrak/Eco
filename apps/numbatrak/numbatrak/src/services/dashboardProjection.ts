export type CompletedOrderProfitRow = {
  id: string;
  profit: number | string | null;
  completed_at: string | null;
  created_at: string | null;
};

export function withinDateRange(
  dateToCheck: string | null,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateToCheck) {
    return false;
  }
  const d = new Date(dateToCheck);
  if (startDate && d < new Date(startDate)) {
    return false;
  }
  if (endDate && d > new Date(endDate)) {
    return false;
  }
  return true;
}

/** Read net profit from form_responses.profit (authoritative after DB triggers). */
export function projectCompletedOrderProfit(
  row: CompletedOrderProfitRow
): number {
  return Number(row.profit) || 0;
}
