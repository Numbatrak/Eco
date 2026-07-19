import { and, desc, eq, sql } from "drizzle-orm";
import {
  platformCreditPricing,
  creditBundles,
  platformCreditLedger,
  organization,
  type Database,
} from "@platform/db";
import type {
  CreditPricing,
  CreditBundle,
  CreateCreditBundleRequest,
  CreditConsumptionResponse,
  CreditConsumptionRow,
  CreditMarginResponse,
} from "@platform/shared-types";

type CreditType = "email" | "whatsapp";
const CREDIT_TYPES: CreditType[] = ["email", "whatsapp"];

// ---------- pricing ----------

export async function getPricing(db: Database): Promise<CreditPricing[]> {
  const rows = await db.select().from(platformCreditPricing);
  const byType = new Map(rows.map((r) => [r.creditType, r]));
  // Always return both types (seeded at migration, but be defensive).
  return CREDIT_TYPES.map((t) => {
    const row = byType.get(t);
    return {
      creditType: t,
      sellPriceCents: row?.sellPriceCents ?? 0,
      providerCostCents: row?.providerCostCents ?? 0,
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
    };
  });
}

export async function setPricing(
  db: Database,
  params: { creditType: CreditType; sellPriceCents: number; providerCostCents: number; adminId: string },
): Promise<void> {
  await db
    .insert(platformCreditPricing)
    .values({
      creditType: params.creditType,
      sellPriceCents: params.sellPriceCents,
      providerCostCents: params.providerCostCents,
      updatedByAdminId: params.adminId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformCreditPricing.creditType,
      set: {
        sellPriceCents: params.sellPriceCents,
        providerCostCents: params.providerCostCents,
        updatedByAdminId: params.adminId,
        updatedAt: new Date(),
      },
    });
}

// ---------- bundles ----------

function serializeBundle(row: typeof creditBundles.$inferSelect): CreditBundle {
  return {
    id: row.id,
    creditType: row.creditType,
    name: row.name,
    units: row.units,
    priceCents: row.priceCents,
    isActive: row.isActive,
    perUnitCents: row.units > 0 ? Math.round((row.priceCents / row.units) * 100) / 100 : 0,
  };
}

export async function listBundles(db: Database): Promise<CreditBundle[]> {
  const rows = await db.select().from(creditBundles).orderBy(creditBundles.creditType, creditBundles.units);
  return rows.map(serializeBundle);
}

export async function createBundle(db: Database, params: CreateCreditBundleRequest): Promise<CreditBundle> {
  const [row] = await db.insert(creditBundles).values(params).returning();
  return serializeBundle(row!);
}

export async function bundleExists(db: Database, id: string): Promise<boolean> {
  const [row] = await db.select({ id: creditBundles.id }).from(creditBundles).where(eq(creditBundles.id, id)).limit(1);
  return Boolean(row);
}

export async function deleteBundle(db: Database, id: string): Promise<void> {
  await db.delete(creditBundles).where(eq(creditBundles.id, id));
}

// ---------- consumption ----------

export async function computeConsumption(db: Database): Promise<CreditConsumptionResponse> {
  const totalsRows = await db
    .select({
      creditType: platformCreditLedger.creditType,
      sold: sql<number>`coalesce(sum(case when ${platformCreditLedger.delta} > 0 and ${platformCreditLedger.transactionId} is not null then ${platformCreditLedger.delta} else 0 end), 0)::int`,
      granted: sql<number>`coalesce(sum(case when ${platformCreditLedger.delta} > 0 and ${platformCreditLedger.transactionId} is null then ${platformCreditLedger.delta} else 0 end), 0)::int`,
      consumed: sql<number>`coalesce(sum(case when ${platformCreditLedger.delta} < 0 then -${platformCreditLedger.delta} else 0 end), 0)::int`,
      remaining: sql<number>`coalesce(sum(${platformCreditLedger.delta}), 0)::int`,
    })
    .from(platformCreditLedger)
    .groupBy(platformCreditLedger.creditType);

  const byType = new Map(totalsRows.map((r) => [r.creditType, r]));
  const totals: CreditConsumptionRow[] = CREDIT_TYPES.map((t) => {
    const r = byType.get(t);
    return {
      creditType: t,
      soldUnits: r?.sold ?? 0,
      grantedUnits: r?.granted ?? 0,
      consumedUnits: r?.consumed ?? 0,
      remainingUnits: r?.remaining ?? 0,
    };
  });

  // Per-tenant drill-in (top tenants by ledger activity).
  const tenantRows = await db
    .select({
      organizationId: platformCreditLedger.organizationId,
      tenantName: organization.name,
      creditType: platformCreditLedger.creditType,
      remaining: sql<number>`coalesce(sum(${platformCreditLedger.delta}), 0)::int`,
      consumed: sql<number>`coalesce(sum(case when ${platformCreditLedger.delta} < 0 then -${platformCreditLedger.delta} else 0 end), 0)::int`,
    })
    .from(platformCreditLedger)
    .leftJoin(organization, eq(platformCreditLedger.organizationId, organization.id))
    .groupBy(platformCreditLedger.organizationId, organization.name, platformCreditLedger.creditType);

  const tenantMap = new Map<
    string,
    { tenantName: string | null; emailRemaining: number; whatsappRemaining: number; emailConsumed: number; whatsappConsumed: number }
  >();
  for (const r of tenantRows) {
    const entry = tenantMap.get(r.organizationId) ?? {
      tenantName: r.tenantName ?? null,
      emailRemaining: 0,
      whatsappRemaining: 0,
      emailConsumed: 0,
      whatsappConsumed: 0,
    };
    if (r.creditType === "email") {
      entry.emailRemaining = r.remaining;
      entry.emailConsumed = r.consumed;
    } else {
      entry.whatsappRemaining = r.remaining;
      entry.whatsappConsumed = r.consumed;
    }
    tenantMap.set(r.organizationId, entry);
  }

  const tenants = [...tenantMap.entries()]
    .map(([organizationId, v]) => ({ organizationId, ...v }))
    .sort((a, b) => b.emailConsumed + b.whatsappConsumed - (a.emailConsumed + a.whatsappConsumed))
    .slice(0, 100);

  return { totals, tenants };
}

// ---------- margin ----------

export async function computeMargin(db: Database): Promise<CreditMarginResponse> {
  const [pricing, consumption] = await Promise.all([getPricing(db), computeConsumption(db)]);
  const soldByType = new Map(consumption.totals.map((t) => [t.creditType, t.soldUnits]));

  const rows = pricing.map((p) => {
    const marginPerUnitCents = p.sellPriceCents - p.providerCostCents;
    const soldUnits = soldByType.get(p.creditType) ?? 0;
    return {
      creditType: p.creditType,
      sellPriceCents: p.sellPriceCents,
      providerCostCents: p.providerCostCents,
      marginPerUnitCents,
      soldUnits,
      totalMarginCents: marginPerUnitCents * soldUnits,
    };
  });

  return { rows, aggregateMarginCents: rows.reduce((s, r) => s + r.totalMarginCents, 0) };
}
