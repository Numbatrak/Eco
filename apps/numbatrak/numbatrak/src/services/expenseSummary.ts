"use client";

import { apiRequest } from "../lib/apiClient";
import { OrgExpenseCategory } from "../constants/expenseCategories";
import { DateFilter, resolveDateRange, withinDateRange } from "../utils/dateRange";
import {
  isAdvertisingCategory,
  normalizeExpenseRow,
} from "../utils/expenseCategoryHelpers";
import { fetchUnifiedExpenses } from "./unifiedExpenses";
import { UnifiedExpenseWithRelations } from "../types/unifiedExpense";

export type ExpenseCategoryTotals = Record<OrgExpenseCategory, number> & {
  agent: number;
};

export type ExpenseSummary = {
  byCategory: ExpenseCategoryTotals;
  totalOrgExpenses: number;
  totalAgentExpenses: number;
  totalExpenses: number;
  advertisingSpend: number;
  nonAdvertisingOrgExpenses: number;
  deliveredRevenue: number;
  expensePercentOfRevenue: number;
  advertisingRoas: number;
};

export const EMPTY_EXPENSE_CATEGORY_TOTALS: ExpenseCategoryTotals = {
  operational: 0,
  building: 0,
  marketing: 0,
  advertising: 0,
  agent: 0,
};

export function filterExpensesByDateRange(
  rows: UnifiedExpenseWithRelations[],
  startDate?: string,
  endDate?: string
): UnifiedExpenseWithRelations[] {
  if (!startDate && !endDate) return rows;
  return rows.filter((r) => withinDateRange(r.occurred_at, startDate, endDate));
}

/** Pure local computation (no revenue) - used for on-the-fly totals over an
 * already-loaded/filtered row set, e.g. a dialog's live category preview. */
export function computeExpenseSummary(
  rows: UnifiedExpenseWithRelations[],
  deliveredRevenue: number
): ExpenseSummary {
  const byCategory: ExpenseCategoryTotals = { ...EMPTY_EXPENSE_CATEGORY_TOTALS };
  let totalOrgExpenses = 0;
  let totalAgentExpenses = 0;
  let advertisingSpend = 0;

  for (const row of rows) {
    const normalized = normalizeExpenseRow(
      row.category,
      row.subcategory,
      row.scope
    );
    const amount = Number(row.amount) || 0;

    if (row.scope === "agent") {
      byCategory.agent += amount;
      totalAgentExpenses += amount;
      continue;
    }

    const cat = normalized.category as OrgExpenseCategory;
    if (cat in byCategory) {
      byCategory[cat] += amount;
    }
    totalOrgExpenses += amount;
    if (isAdvertisingCategory(cat)) {
      advertisingSpend += amount;
    }
  }

  const totalExpenses = totalOrgExpenses + totalAgentExpenses;
  const nonAdvertisingOrgExpenses = totalOrgExpenses - advertisingSpend;
  const expensePercentOfRevenue =
    deliveredRevenue > 0 ? (totalExpenses / deliveredRevenue) * 100 : 0;
  const advertisingRoas =
    advertisingSpend > 0 ? deliveredRevenue / advertisingSpend : 0;

  return {
    byCategory,
    totalOrgExpenses,
    totalAgentExpenses,
    totalExpenses,
    advertisingSpend,
    nonAdvertisingOrgExpenses,
    deliveredRevenue,
    expensePercentOfRevenue,
    advertisingRoas,
  };
}

interface SummaryDto {
  byCategory: ExpenseCategoryTotals;
  totalOrgExpenses: number;
  totalAgentExpenses: number;
  totalExpenses: number;
  advertisingSpend: number;
  nonAdvertisingOrgExpenses: number;
  deliveredRevenue: number;
  expensePercentOfRevenue: number;
  advertisingRoas: number;
}

/** Computed server-side (byCategory bucketing + delivered revenue join) -
 * see apps/api's numbatrak-expenses/lib/summary.ts. */
export async function fetchExpenseSummary(
  organizationId: string | null,
  dateFilter?: DateFilter
): Promise<ExpenseSummary> {
  if (!organizationId) {
    return computeExpenseSummary([], 0);
  }

  const { startDate, endDate } = resolveDateRange(dateFilter);
  const params = new URLSearchParams();
  if (startDate) params.set("dateFrom", startDate);
  if (endDate) params.set("dateTo", endDate);

  return apiRequest<SummaryDto>(`/org/numbatrak/expenses/summary?${params.toString()}`);
}

/** Dashboard legacy fields: agent vs org totals from unified ledger. */
export async function fetchUnifiedExpenseTotals(
  organizationId: string | null,
  startDate?: string,
  endDate?: string
): Promise<{ totalAgentExpenses: number; totalGeneralExpenses: number }> {
  if (!organizationId) {
    return { totalAgentExpenses: 0, totalGeneralExpenses: 0 };
  }

  const params = new URLSearchParams();
  if (startDate) params.set("dateFrom", startDate);
  if (endDate) params.set("dateTo", endDate);

  const summary = await apiRequest<SummaryDto>(`/org/numbatrak/expenses/summary?${params.toString()}`);
  return { totalAgentExpenses: summary.totalAgentExpenses, totalGeneralExpenses: summary.totalOrgExpenses };
}

export type MonthlyExpensePoint = {
  month: string;
  operational: number;
  building: number;
  marketing: number;
  advertising: number;
  agent: number;
  total: number;
};

export function computeMonthlyExpenseSeries(
  rows: UnifiedExpenseWithRelations[]
): MonthlyExpensePoint[] {
  const byMonth = new Map<string, MonthlyExpensePoint>();

  for (const row of rows) {
    const month = String(row.occurred_at).slice(0, 7);
    if (!month || month.length < 7) continue;

    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        operational: 0,
        building: 0,
        marketing: 0,
        advertising: 0,
        agent: 0,
        total: 0,
      });
    }
    const point = byMonth.get(month)!;
    const amount = Number(row.amount) || 0;
    const normalized = normalizeExpenseRow(
      row.category,
      row.subcategory,
      row.scope
    );

    if (row.scope === "agent") {
      point.agent += amount;
    } else {
      switch (normalized.category) {
        case "operational":
          point.operational += amount;
          break;
        case "building":
          point.building += amount;
          break;
        case "marketing":
          point.marketing += amount;
          break;
        case "advertising":
          point.advertising += amount;
          break;
        default:
          break;
      }
    }
    point.total += amount;
  }

  return Array.from(byMonth.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
}

export async function fetchMonthlyExpenseSeries(
  organizationId: string | null,
  dateFilter?: DateFilter
): Promise<MonthlyExpensePoint[]> {
  if (!organizationId) return [];
  const { startDate, endDate } = resolveDateRange(dateFilter);
  const rows = filterExpensesByDateRange(
    await fetchUnifiedExpenses(organizationId),
    startDate,
    endDate
  );
  return computeMonthlyExpenseSeries(rows);
}
