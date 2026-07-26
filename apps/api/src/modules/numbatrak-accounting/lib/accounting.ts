import { and, eq, inArray, sql } from "drizzle-orm";
import { numbatrakCustomerOrders, numbatrakUnifiedExpenses, numbatrakWalletRemittanceLines, type Database } from "@platform/db";
import { normalizeOrgExpenseCategory, isAdvertisingCategory } from "../../numbatrak-expenses/lib/category-normalization.js";
import { DELIVERED_STATUSES } from "../../numbatrak-orders/lib/order-status.js";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function withinRange(date: Date, startDate?: string, endDate?: string): boolean {
  if (startDate && date < new Date(startDate)) return false;
  if (endDate && date > new Date(endDate)) return false;
  return true;
}

export interface AccountingPnL {
  revenue: {
    total: number;
    bySubBrand: Record<string, number>;
  };
  cogs: number;
  grossProfit: number;
  expenses: {
    operational: number;
    building: number;
    marketing: number;
    advertising: number;
    agent: number;
    total: number;
  };
  netProfit: number;
  orderCount: number;
  avgOrderValue: number;
  profitMargin: number;
}

export interface AccountingCashPosition {
  totalEarned: number;
  totalCollected: number;
  outstandingCod: number;
  collectionRate: number;
}

export interface AccountingReport {
  pnl: AccountingPnL;
  cashPosition: AccountingCashPosition;
}

export async function getAccountingReport(
  db: Database,
  organizationId: string,
  query: { dateFrom?: string; dateTo?: string; subBrand?: string },
): Promise<AccountingReport> {
  const orderConditions = [
    eq(numbatrakCustomerOrders.organizationId, organizationId),
    inArray(numbatrakCustomerOrders.status, DELIVERED_STATUSES),
  ];
  if (query.subBrand) {
    orderConditions.push(eq(numbatrakCustomerOrders.subBrand, query.subBrand));
  }

  const orderRows = await db
    .select({
      orderRevenue: numbatrakCustomerOrders.orderRevenue,
      orderCost: numbatrakCustomerOrders.orderCost,
      profit: numbatrakCustomerOrders.profit,
      subBrand: numbatrakCustomerOrders.subBrand,
      completedAt: numbatrakCustomerOrders.completedAt,
      createdAt: numbatrakCustomerOrders.createdAt,
      moneyReceivedBy: numbatrakCustomerOrders.moneyReceivedBy,
      walletStatus: numbatrakCustomerOrders.walletStatus,
    })
    .from(numbatrakCustomerOrders)
    .where(and(...orderConditions));

  let totalRevenue = 0;
  let totalCogs = 0;
  let orderCount = 0;
  const bySubBrand: Record<string, number> = {};
  let totalEarned = 0;
  let totalCollected = 0;

  for (const row of orderRows) {
    const anchor = row.completedAt ?? row.createdAt;
    if (!anchor || !withinRange(anchor, query.dateFrom, query.dateTo)) continue;

    const revenue = num(row.orderRevenue);
    const cost = num(row.orderCost);
    totalRevenue += revenue;
    totalCogs += cost;
    orderCount++;
    totalEarned += revenue;

    const brand = row.subBrand?.trim() || "Default";
    bySubBrand[brand] = (bySubBrand[brand] ?? 0) + revenue;

    if (row.moneyReceivedBy === "agent_collected") {
      if (row.walletStatus === "collected" || row.walletStatus === "released") {
        totalCollected += revenue;
      }
    } else {
      totalCollected += revenue;
    }
  }

  const expenseRows = await db
    .select({
      scope: numbatrakUnifiedExpenses.scope,
      category: numbatrakUnifiedExpenses.category,
      amount: numbatrakUnifiedExpenses.amount,
      occurredAt: numbatrakUnifiedExpenses.occurredAt,
    })
    .from(numbatrakUnifiedExpenses)
    .where(eq(numbatrakUnifiedExpenses.organizationId, organizationId));

  const expenses = { operational: 0, building: 0, marketing: 0, advertising: 0, agent: 0, total: 0 };

  for (const row of expenseRows) {
    if (!withinRange(new Date(row.occurredAt), query.dateFrom, query.dateTo)) continue;
    const amount = num(row.amount);

    if (row.scope === "agent") {
      expenses.agent += amount;
      expenses.total += amount;
      continue;
    }

    const cat = normalizeOrgExpenseCategory(row.category);
    expenses[cat] += amount;
    expenses.total += amount;
  }

  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - expenses.total;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const outstandingCod = totalEarned - totalCollected;
  const collectionRate = totalEarned > 0 ? (totalCollected / totalEarned) * 100 : 0;

  return {
    pnl: {
      revenue: { total: totalRevenue, bySubBrand },
      cogs: totalCogs,
      grossProfit,
      expenses,
      netProfit,
      orderCount,
      avgOrderValue,
      profitMargin,
    },
    cashPosition: {
      totalEarned,
      totalCollected,
      outstandingCod,
      collectionRate,
    },
  };
}

export async function listSubBrands(db: Database, organizationId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subBrand: numbatrakCustomerOrders.subBrand })
    .from(numbatrakCustomerOrders)
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        sql`${numbatrakCustomerOrders.subBrand} IS NOT NULL AND ${numbatrakCustomerOrders.subBrand} != ''`,
      ),
    );
  return rows.map((r) => r.subBrand!).sort();
}
