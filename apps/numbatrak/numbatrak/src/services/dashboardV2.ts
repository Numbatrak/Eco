"use client";

import {
  fetchBusinessPerformanceMetrics,
  BusinessPerformanceMetrics,
} from "./dashboardMetrics";

export interface DashboardV2Kpis {
  totalProfit: number;
  cpa: number;
  adSpend: number;
  newOrdersForCpa: number;
  /** Full spec-aligned metrics bundle */
  performance: BusinessPerformanceMetrics;
}

export async function fetchDashboardV2Kpis(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null
): Promise<DashboardV2Kpis> {
  const performance = await fetchBusinessPerformanceMetrics(
    organizationId,
    startDate,
    endDate,
    { formId, csrId }
  );
  return {
    totalProfit: performance.totalProfit,
    cpa: performance.platformCpa,
    adSpend: performance.adSpend,
    newOrdersForCpa: performance.totalOrdersGenerated,
    performance,
  };
}
