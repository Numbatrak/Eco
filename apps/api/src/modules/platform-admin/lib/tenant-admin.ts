import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  creditAdjustments,
  orders,
  organization,
  type Database,
} from "@platform/db";
import type {
  CreditAdjustment,
  PlatformAdminTenantDetail,
  PlatformAdminTenantSummary,
  TenantStatus,
} from "@platform/shared-types";

interface TenantAggregates {
  creditBalance: number;
  orderCount: number;
  revenueCents: number;
}

async function loadAggregates(db: Database, tenantIds: string[]): Promise<Map<string, TenantAggregates>> {
  const aggregates = new Map<string, TenantAggregates>();
  if (tenantIds.length === 0) {
    return aggregates;
  }
  for (const id of tenantIds) {
    aggregates.set(id, { creditBalance: 0, orderCount: 0, revenueCents: 0 });
  }

  const creditRows = await db
    .select({
      tenantId: creditAdjustments.tenantId,
      balance: sql<number>`coalesce(sum(${creditAdjustments.delta}), 0)::int`,
    })
    .from(creditAdjustments)
    .where(inArray(creditAdjustments.tenantId, tenantIds))
    .groupBy(creditAdjustments.tenantId);
  for (const row of creditRows) {
    const entry = aggregates.get(row.tenantId);
    if (entry) entry.creditBalance = row.balance;
  }

  const orderRows = await db
    .select({
      tenantId: orders.tenantId,
      orderCount: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(case when ${orders.status} = 'paid' then ${orders.totalCents} else 0 end), 0)::int`,
    })
    .from(orders)
    .where(inArray(orders.tenantId, tenantIds))
    .groupBy(orders.tenantId);
  for (const row of orderRows) {
    const entry = aggregates.get(row.tenantId);
    if (entry) {
      entry.orderCount = row.orderCount;
      entry.revenueCents = row.revenueCents;
    }
  }

  return aggregates;
}

function serializeSummary(
  row: { id: string; name: string; subdomain: string; status: TenantStatus; plan: string; createdAt: Date },
  aggregates: TenantAggregates,
): PlatformAdminTenantSummary {
  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    status: row.status,
    plan: row.plan,
    creditBalance: aggregates.creditBalance,
    orderCount: aggregates.orderCount,
    revenueCents: aggregates.revenueCents,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListTenantsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ListTenantsResult {
  tenants: PlatformAdminTenantSummary[];
  total: number;
}

export async function listTenantsForAdmin(
  db: Database,
  params: ListTenantsParams,
): Promise<ListTenantsResult> {
  const searchFilter = params.search
    ? sql`(lower(${organization.name}) like lower(${`%${params.search}%`}) or lower(${organization.slug}) like lower(${`%${params.search}%`}))`
    : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organization)
    .where(searchFilter);
  const count = countRow?.count ?? 0;

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      status: organization.status,
      plan: organization.plan,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .where(searchFilter)
    .orderBy(desc(organization.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const aggregates = await loadAggregates(
    db,
    rows.map((row) => row.id),
  );

  return {
    tenants: rows.map((row) => serializeSummary(row, aggregates.get(row.id) ?? { creditBalance: 0, orderCount: 0, revenueCents: 0 })),
    total: count,
  };
}

export async function getTenantDetailForAdmin(
  db: Database,
  tenantId: string,
): Promise<PlatformAdminTenantDetail | null> {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.slug,
      status: organization.status,
      plan: organization.plan,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .where(eq(organization.id, tenantId))
    .limit(1);
  if (!row) {
    return null;
  }

  const aggregates = await loadAggregates(db, [tenantId]);
  const adjustmentRows = await db
    .select()
    .from(creditAdjustments)
    .where(eq(creditAdjustments.tenantId, tenantId))
    .orderBy(desc(creditAdjustments.createdAt));

  const adjustments: CreditAdjustment[] = adjustmentRows.map((adj) => ({
    id: adj.id,
    delta: adj.delta,
    reason: adj.reason,
    adminId: adj.adminId,
    createdAt: adj.createdAt.toISOString(),
  }));

  return {
    ...serializeSummary(row, aggregates.get(tenantId) ?? { creditBalance: 0, orderCount: 0, revenueCents: 0 }),
    creditAdjustments: adjustments,
  };
}

export async function suspendTenant(db: Database, tenantId: string): Promise<void> {
  await db.update(organization).set({ status: "suspended" }).where(eq(organization.id, tenantId));
}

export async function reactivateTenant(db: Database, tenantId: string): Promise<void> {
  await db.update(organization).set({ status: "active" }).where(eq(organization.id, tenantId));
}

export async function updateTenantPlan(db: Database, tenantId: string, plan: string): Promise<void> {
  await db.update(organization).set({ plan }).where(eq(organization.id, tenantId));
}

export async function adjustTenantCredits(
  db: Database,
  params: { tenantId: string; adminId: string; delta: number; reason: string },
): Promise<void> {
  await db.insert(creditAdjustments).values({
    tenantId: params.tenantId,
    adminId: params.adminId,
    delta: params.delta,
    reason: params.reason,
  });
}

export async function tenantExists(db: Database, tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, tenantId))
    .limit(1);
  return Boolean(row);
}
