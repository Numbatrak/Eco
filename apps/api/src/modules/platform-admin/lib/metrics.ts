import { and, eq, gte, lte, sql } from "drizzle-orm";
import { orders, organization, type Database } from "@platform/db";
import type { MetricsOverviewResponse } from "@platform/shared-types";

const DEFAULT_RANGE_DAYS = 30;

export interface OverviewMetricsParams {
  from?: string;
  to?: string;
}

export async function getOverviewMetrics(
  db: Database,
  params: OverviewMetricsParams,
): Promise<MetricsOverviewResponse> {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from
    ? new Date(params.from)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const [orderStats] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then ${orders.totalCents} else 0 end), 0)::int`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)));

  const [activeTenantRow] = await db
    .select({ activeTenantCount: sql<number>`count(*)::int` })
    .from(organization)
    .where(eq(organization.status, "active"));

  const [newTenantRow] = await db
    .select({ newTenantSignups: sql<number>`count(*)::int` })
    .from(organization)
    .where(and(gte(organization.createdAt, from), lte(organization.createdAt, to)));

  return {
    revenueCents: orderStats?.revenueCents ?? 0,
    orderCount: orderStats?.orderCount ?? 0,
    activeTenantCount: activeTenantRow?.activeTenantCount ?? 0,
    newTenantSignups: newTenantRow?.newTenantSignups ?? 0,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
