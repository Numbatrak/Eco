// Verbatim server-side port of services/dashboardMetrics.ts's pure
// computeBusinessPerformanceMetrics/computeLossMetrics - can't import
// frontend code from apps/api. Kept byte-for-byte equivalent to the source.
import type { NumbatrakBusinessPerformanceMetrics, NumbatrakLossMetrics } from "@platform/shared-types";
import { isDeliveredStatus } from "../../numbatrak-orders/lib/order-status.js";
import type { MetricsOrderRow } from "./order-rows.js";

function isGeneratedOrder(row: MetricsOrderRow): boolean {
  return row.status !== "cancelled";
}

function isDeliveredOrder(row: MetricsOrderRow): boolean {
  return isDeliveredStatus(row.status);
}

function withinRange(iso: string, startDate?: string, endDate?: string): boolean {
  const d = new Date(iso);
  if (startDate && d < new Date(startDate)) return false;
  if (endDate && d > new Date(endDate)) return false;
  return true;
}

function inGeneratedPeriod(row: MetricsOrderRow, startDate?: string, endDate?: string): boolean {
  return withinRange(row.createdAt, startDate, endDate);
}

function inDeliveredPeriod(row: MetricsOrderRow, startDate?: string, endDate?: string): boolean {
  return withinRange(row.completedAt ?? row.createdAt, startDate, endDate);
}

export function computeBusinessPerformanceMetrics(input: {
  orders: MetricsOrderRow[];
  adSpend: number;
  totalNonAdExpenses: number;
  startDate?: string;
  endDate?: string;
}): NumbatrakBusinessPerformanceMetrics {
  const { orders, adSpend, totalNonAdExpenses, startDate, endDate } = input;

  const generated = orders.filter((o) => isGeneratedOrder(o) && inGeneratedPeriod(o, startDate, endDate));
  const delivered = orders.filter((o) => isDeliveredOrder(o) && inDeliveredPeriod(o, startDate, endDate));

  const totalOrdersGenerated = generated.length;
  const totalOrdersDelivered = delivered.length;

  const deliveryRate = totalOrdersGenerated > 0 ? (totalOrdersDelivered / totalOrdersGenerated) * 100 : 0;

  const totalDeliveredSales = delivered.reduce((s, o) => s + o.orderRevenue, 0);
  const totalCogs = delivered.reduce((s, o) => s + o.orderCost, 0);
  const totalDeliveryFees = delivered.reduce((s, o) => s + o.deliveryFee, 0);

  const averageOrderValue = totalOrdersDelivered > 0 ? totalDeliveredSales / totalOrdersDelivered : 0;
  const averageCogs = totalOrdersDelivered > 0 ? totalCogs / totalOrdersDelivered : 0;
  const averageDeliveryFee = totalOrdersDelivered > 0 ? totalDeliveryFees / totalOrdersDelivered : 0;

  const platformCpa = totalOrdersGenerated > 0 && adSpend > 0 ? adSpend / totalOrdersGenerated : 0;
  const realCpa = totalOrdersDelivered > 0 && adSpend > 0 ? adSpend / totalOrdersDelivered : 0;
  const cpaGap = realCpa - platformCpa;

  const profitPerOrder = averageOrderValue - realCpa - averageCogs - averageDeliveryFee;
  const totalProfit = profitPerOrder * totalOrdersDelivered;

  const roas = adSpend > 0 ? totalDeliveredSales / adSpend : 0;

  const totalInvestment = adSpend + totalNonAdExpenses;
  const netProfitAfterAllExpenses = totalDeliveredSales - totalCogs - totalDeliveryFees - totalInvestment;
  const businessRoi = totalInvestment > 0 ? netProfitAfterAllExpenses / totalInvestment : 0;

  return {
    totalOrdersGenerated,
    totalOrdersDelivered,
    deliveryRate,
    totalDeliveredSales,
    averageOrderValue,
    adSpend,
    platformCpa,
    realCpa,
    cpaGap,
    totalCogs,
    averageCogs,
    totalDeliveryFees,
    averageDeliveryFee,
    profitPerOrder,
    totalProfit,
    roas,
    businessRoi,
    totalNonAdExpenses,
    totalInvestment,
    netProfitAfterAllExpenses,
  };
}

export function computeLossMetrics(input: {
  orders: MetricsOrderRow[];
  adSpend: number;
  failedDeliveryCost: number;
  startDate?: string;
  endDate?: string;
}): NumbatrakLossMetrics {
  const { orders, adSpend, failedDeliveryCost, startDate, endDate } = input;

  const generated = orders.filter((o) => isGeneratedOrder(o) && inGeneratedPeriod(o, startDate, endDate));
  const undelivered = generated.filter((o) => !isDeliveredOrder(o));

  const undeliveredCount = undelivered.length;
  const wouldBeSales = undelivered.reduce((s, o) => s + o.orderRevenue, 0);
  const allocatedAdSpend = generated.length > 0 && adSpend > 0 ? adSpend * (undeliveredCount / generated.length) : 0;

  const statusMap = new Map<string, { status: string; count: number; wouldBeSales: number }>();
  for (const row of undelivered) {
    const status = row.status || "unknown";
    const existing = statusMap.get(status);
    if (existing) {
      existing.count += 1;
      existing.wouldBeSales += row.orderRevenue;
    } else {
      statusMap.set(status, { status, count: 1, wouldBeSales: row.orderRevenue });
    }
  }

  const byStatus = [...statusMap.values()].sort((a, b) => b.count - a.count);

  return { undeliveredCount, wouldBeSales, allocatedAdSpend, failedDeliveryCost, byStatus };
}
