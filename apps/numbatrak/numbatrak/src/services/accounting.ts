"use client";

import { apiRequest } from "../lib/apiClient";

interface PnLDto {
  revenue: { total: number; bySubBrand: Record<string, number> };
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

interface CashPositionDto {
  totalEarned: number;
  totalCollected: number;
  outstandingCod: number;
  collectionRate: number;
}

interface AccountingReportDto {
  pnl: PnLDto;
  cashPosition: CashPositionDto;
}

export interface AccountingPnL {
  revenue: { total: number; by_sub_brand: Record<string, number> };
  cogs: number;
  gross_profit: number;
  expenses: {
    operational: number;
    building: number;
    marketing: number;
    advertising: number;
    agent: number;
    total: number;
  };
  net_profit: number;
  order_count: number;
  avg_order_value: number;
  profit_margin: number;
}

export interface AccountingCashPosition {
  total_earned: number;
  total_collected: number;
  outstanding_cod: number;
  collection_rate: number;
}

export interface AccountingReport {
  pnl: AccountingPnL;
  cash_position: AccountingCashPosition;
}

function reportFromDto(d: AccountingReportDto): AccountingReport {
  return {
    pnl: {
      revenue: { total: d.pnl.revenue.total, by_sub_brand: d.pnl.revenue.bySubBrand },
      cogs: d.pnl.cogs,
      gross_profit: d.pnl.grossProfit,
      expenses: d.pnl.expenses,
      net_profit: d.pnl.netProfit,
      order_count: d.pnl.orderCount,
      avg_order_value: d.pnl.avgOrderValue,
      profit_margin: d.pnl.profitMargin,
    },
    cash_position: {
      total_earned: d.cashPosition.totalEarned,
      total_collected: d.cashPosition.totalCollected,
      outstanding_cod: d.cashPosition.outstandingCod,
      collection_rate: d.cashPosition.collectionRate,
    },
  };
}

export async function fetchAccountingReport(params?: {
  dateFrom?: string;
  dateTo?: string;
  subBrand?: string;
}): Promise<AccountingReport> {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.subBrand) searchParams.set("subBrand", params.subBrand);
  const qs = searchParams.toString();
  const url = `/org/numbatrak/accounting${qs ? `?${qs}` : ""}`;
  const dto = await apiRequest<AccountingReportDto>(url);
  return reportFromDto(dto);
}

export async function fetchSubBrands(): Promise<string[]> {
  const { subBrands } = await apiRequest<{ subBrands: string[] }>("/org/numbatrak/accounting/sub-brands");
  return subBrands;
}
