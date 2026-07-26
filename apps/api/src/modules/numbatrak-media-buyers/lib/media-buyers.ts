import { and, eq, desc, sql, asc } from "drizzle-orm";
import {
  numbatrakMediaBuyerSettings,
  numbatrakContractors,
  numbatrakProductionBatches,
  numbatrakContractorPayments,
  numbatrakAdCatalog,
  numbatrakAdSpend,
  numbatrakCpaTargets,
  numbatrakWeeklyReviews,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakMediaBuyerSettings,
  NumbatrakContractor,
  NumbatrakProductionBatch,
  NumbatrakContractorPayment,
  NumbatrakAdCatalogEntry,
  NumbatrakAdSpendEntry,
  NumbatrakCpaTarget,
  NumbatrakWeeklyReview,
  NumbatrakPerformanceAnalytics,
} from "@platform/shared-types";

type SettingsRow = typeof numbatrakMediaBuyerSettings.$inferSelect;
type ContractorRow = typeof numbatrakContractors.$inferSelect;
type BatchRow = typeof numbatrakProductionBatches.$inferSelect;
type PaymentRow = typeof numbatrakContractorPayments.$inferSelect;
type AdRow = typeof numbatrakAdCatalog.$inferSelect;
type SpendRow = typeof numbatrakAdSpend.$inferSelect;
type TargetRow = typeof numbatrakCpaTargets.$inferSelect;
type ReviewRow = typeof numbatrakWeeklyReviews.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakMediaBuyerSettings {
  return {
    id: row.id,
    weeklyReviewEnabled: row.weeklyReviewEnabled,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeContractor(
  row: ContractorRow,
  piecesDone: number,
  piecesPaid: number,
): NumbatrakContractor {
  const rate = Number(row.rate);
  const piecesUnpaid = piecesDone - piecesPaid;
  return {
    id: row.id,
    name: row.name,
    role: row.role as NumbatrakContractor["role"],
    rate,
    active: row.active,
    piecesDone,
    piecesPaid,
    piecesUnpaid,
    amountOwed: piecesUnpaid * rate,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeBatch(
  row: BatchRow,
  buyerName: string | null,
  voArtistName: string | null,
  editorName: string | null,
): NumbatrakProductionBatch {
  return {
    id: row.id,
    buyerId: row.buyerId,
    buyerName,
    brand: row.brand,
    productId: row.productId,
    creativeType: row.creativeType as NumbatrakProductionBatch["creativeType"],
    description: row.description,
    voArtistId: row.voArtistId,
    voArtistName,
    editorId: row.editorId,
    editorName,
    videoCount: row.videoCount,
    status: row.status as NumbatrakProductionBatch["status"],
    driveLink: row.driveLink,
    doneAt: row.doneAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializePayment(row: PaymentRow, contractorName: string | null): NumbatrakContractorPayment {
  return {
    id: row.id,
    contractorId: row.contractorId,
    contractorName,
    pieces: row.pieces,
    amount: Number(row.amount),
    brand: row.brand,
    paidAt: row.paidAt?.toISOString() ?? "",
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

function serializeAd(row: AdRow, editorName: string | null): NumbatrakAdCatalogEntry {
  return {
    id: row.id,
    batchId: row.batchId,
    name: row.name,
    hookType: row.hookType,
    creativeType: row.creativeType,
    brand: row.brand,
    productId: row.productId,
    offerId: row.offerId,
    driveLink: row.driveLink,
    editorName,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeSpend(row: SpendRow, buyerName: string | null): NumbatrakAdSpendEntry {
  const spend = Number(row.spend);
  return {
    id: row.id,
    buyerId: row.buyerId,
    buyerName,
    spendDate: row.spendDate,
    brand: row.brand,
    productId: row.productId,
    offerId: row.offerId,
    platform: row.platform,
    spend,
    orders: row.orders,
    cpa: row.orders > 0 ? spend / row.orders : 0,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeTarget(row: TargetRow, buyerName: string | null): NumbatrakCpaTarget {
  return {
    id: row.id,
    buyerId: row.buyerId,
    buyerName,
    brand: row.brand,
    productId: row.productId,
    offerId: row.offerId,
    cpaTarget: Number(row.cpaTarget),
    weeklyBudget: Number(row.weeklyBudget),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeReview(row: ReviewRow, buyerName: string | null): NumbatrakWeeklyReview {
  return {
    id: row.id,
    buyerId: row.buyerId,
    buyerName,
    weekStart: row.weekStart,
    adsToScale: row.adsToScale,
    adsToPause: row.adsToPause,
    adsToKill: row.adsToKill,
    biggestWin: row.biggestWin,
    biggestIssue: row.biggestIssue,
    verdict: row.verdict as NumbatrakWeeklyReview["verdict"],
    nextWeekDecisions: row.nextWeekDecisions,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

// --- Settings ---

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakMediaBuyerSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakMediaBuyerSettings)
    .where(eq(numbatrakMediaBuyerSettings.organizationId, organizationId))
    .limit(1);
  if (existing) return serializeSettings(existing);
  const [row] = await db
    .insert(numbatrakMediaBuyerSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: { weeklyReviewEnabled?: boolean },
): Promise<NumbatrakMediaBuyerSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakMediaBuyerSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.weeklyReviewEnabled !== undefined) values.weeklyReviewEnabled = input.weeklyReviewEnabled;
  const [row] = await db
    .update(numbatrakMediaBuyerSettings)
    .set(values)
    .where(eq(numbatrakMediaBuyerSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

// --- Contractors ---

export async function listContractors(db: Database, organizationId: string): Promise<NumbatrakContractor[]> {
  const rows = await db
    .select()
    .from(numbatrakContractors)
    .where(eq(numbatrakContractors.organizationId, organizationId))
    .orderBy(asc(numbatrakContractors.name));

  const result: NumbatrakContractor[] = [];
  for (const row of rows) {
    const [doneResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${numbatrakProductionBatches.videoCount}), 0)::int` })
      .from(numbatrakProductionBatches)
      .where(
        and(
          eq(numbatrakProductionBatches.organizationId, organizationId),
          eq(numbatrakProductionBatches.status, "done"),
          row.role === "vo_artist"
            ? eq(numbatrakProductionBatches.voArtistId, row.id)
            : eq(numbatrakProductionBatches.editorId, row.id),
        ),
      );
    const piecesDone = doneResult?.total ?? 0;

    const [paidResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${numbatrakContractorPayments.pieces}), 0)::int` })
      .from(numbatrakContractorPayments)
      .where(
        and(
          eq(numbatrakContractorPayments.organizationId, organizationId),
          eq(numbatrakContractorPayments.contractorId, row.id),
        ),
      );
    const piecesPaid = paidResult?.total ?? 0;

    result.push(serializeContractor(row, piecesDone, piecesPaid));
  }
  return result;
}

export async function createContractor(
  db: Database,
  organizationId: string,
  input: { name: string; role: string; rate: number },
): Promise<NumbatrakContractor> {
  const [row] = await db
    .insert(numbatrakContractors)
    .values({ organizationId, name: input.name, role: input.role, rate: String(input.rate) })
    .returning();
  return serializeContractor(row!, 0, 0);
}

export async function deleteContractor(db: Database, organizationId: string, contractorId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakContractors)
    .where(and(eq(numbatrakContractors.id, contractorId), eq(numbatrakContractors.organizationId, organizationId)));
  return (result.rowCount ?? 0) > 0;
}

// --- Production Batches ---

export async function listBatches(db: Database, organizationId: string): Promise<NumbatrakProductionBatch[]> {
  const rows = await db
    .select()
    .from(numbatrakProductionBatches)
    .where(eq(numbatrakProductionBatches.organizationId, organizationId))
    .orderBy(desc(numbatrakProductionBatches.createdAt));

  const result: NumbatrakProductionBatch[] = [];
  for (const row of rows) {
    let buyerName: string | null = null;
    if (row.buyerId) {
      const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.buyerId)).limit(1);
      buyerName = u?.name ?? null;
    }
    let voArtistName: string | null = null;
    if (row.voArtistId) {
      const [c] = await db.select({ name: numbatrakContractors.name }).from(numbatrakContractors).where(eq(numbatrakContractors.id, row.voArtistId)).limit(1);
      voArtistName = c?.name ?? null;
    }
    let editorName: string | null = null;
    if (row.editorId) {
      const [c] = await db.select({ name: numbatrakContractors.name }).from(numbatrakContractors).where(eq(numbatrakContractors.id, row.editorId)).limit(1);
      editorName = c?.name ?? null;
    }
    result.push(serializeBatch(row, buyerName, voArtistName, editorName));
  }
  return result;
}

export async function createBatch(
  db: Database,
  organizationId: string,
  input: {
    buyerId?: string | null;
    brand?: string | null;
    productId?: string | null;
    creativeType: string;
    description?: string | null;
    voArtistId?: string | null;
    editorId?: string | null;
    videoCount?: number;
  },
): Promise<NumbatrakProductionBatch> {
  const [row] = await db
    .insert(numbatrakProductionBatches)
    .values({
      organizationId,
      buyerId: input.buyerId ?? null,
      brand: input.brand ?? null,
      productId: input.productId ?? null,
      creativeType: input.creativeType,
      description: input.description ?? null,
      voArtistId: input.voArtistId ?? null,
      editorId: input.editorId ?? null,
      videoCount: input.videoCount ?? 1,
    })
    .returning();
  return serializeBatch(row!, null, null, null);
}

export async function markBatchDone(
  db: Database,
  organizationId: string,
  batchId: string,
  driveLink: string | null,
): Promise<NumbatrakProductionBatch | null> {
  const [batch] = await db
    .select()
    .from(numbatrakProductionBatches)
    .where(and(eq(numbatrakProductionBatches.id, batchId), eq(numbatrakProductionBatches.organizationId, organizationId)))
    .limit(1);
  if (!batch) return null;

  const [updated] = await db
    .update(numbatrakProductionBatches)
    .set({ status: "done", doneAt: new Date(), driveLink: driveLink ?? batch.driveLink, updatedAt: new Date() })
    .where(eq(numbatrakProductionBatches.id, batchId))
    .returning();

  for (let i = 0; i < (updated?.videoCount ?? 0); i++) {
    await db.insert(numbatrakAdCatalog).values({
      organizationId,
      batchId,
      name: `${batch.creativeType}-${i + 1}`,
      creativeType: batch.creativeType,
      brand: batch.brand,
      productId: batch.productId,
      driveLink: driveLink ?? batch.driveLink,
      editorId: batch.editorId,
    });
  }

  return serializeBatch(updated!, null, null, null);
}

// --- Contractor Payments ---

export async function listPayments(db: Database, organizationId: string): Promise<NumbatrakContractorPayment[]> {
  const rows = await db
    .select({ payment: numbatrakContractorPayments, contractorName: numbatrakContractors.name })
    .from(numbatrakContractorPayments)
    .innerJoin(numbatrakContractors, eq(numbatrakContractorPayments.contractorId, numbatrakContractors.id))
    .where(eq(numbatrakContractorPayments.organizationId, organizationId))
    .orderBy(desc(numbatrakContractorPayments.paidAt));
  return rows.map((r) => serializePayment(r.payment, r.contractorName));
}

export async function payContractor(
  db: Database,
  organizationId: string,
  contractorId: string,
  pieces: number,
  amount: number,
  brand: string | null,
): Promise<NumbatrakContractorPayment> {
  const [row] = await db
    .insert(numbatrakContractorPayments)
    .values({ organizationId, contractorId, pieces, amount: String(amount), brand })
    .returning();
  return serializePayment(row!, null);
}

// --- Ad Catalog ---

export async function listAds(db: Database, organizationId: string): Promise<NumbatrakAdCatalogEntry[]> {
  const rows = await db
    .select()
    .from(numbatrakAdCatalog)
    .where(eq(numbatrakAdCatalog.organizationId, organizationId))
    .orderBy(desc(numbatrakAdCatalog.createdAt));

  const result: NumbatrakAdCatalogEntry[] = [];
  for (const row of rows) {
    let editorName: string | null = null;
    if (row.editorId) {
      const [c] = await db.select({ name: numbatrakContractors.name }).from(numbatrakContractors).where(eq(numbatrakContractors.id, row.editorId)).limit(1);
      editorName = c?.name ?? null;
    }
    result.push(serializeAd(row, editorName));
  }
  return result;
}

// --- Ad Spend ---

export async function listSpend(db: Database, organizationId: string): Promise<NumbatrakAdSpendEntry[]> {
  const rows = await db
    .select()
    .from(numbatrakAdSpend)
    .where(eq(numbatrakAdSpend.organizationId, organizationId))
    .orderBy(desc(numbatrakAdSpend.spendDate));

  const result: NumbatrakAdSpendEntry[] = [];
  for (const row of rows) {
    let buyerName: string | null = null;
    if (row.buyerId) {
      const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.buyerId)).limit(1);
      buyerName = u?.name ?? null;
    }
    result.push(serializeSpend(row, buyerName));
  }
  return result;
}

export async function createSpend(
  db: Database,
  organizationId: string,
  buyerId: string,
  input: {
    spendDate: string;
    brand?: string | null;
    productId?: string | null;
    offerId?: string | null;
    platform?: string | null;
    spend: number;
    orders: number;
  },
): Promise<NumbatrakAdSpendEntry> {
  const [row] = await db
    .insert(numbatrakAdSpend)
    .values({
      organizationId,
      buyerId,
      spendDate: input.spendDate,
      brand: input.brand ?? null,
      productId: input.productId ?? null,
      offerId: input.offerId ?? null,
      platform: input.platform ?? null,
      spend: String(input.spend),
      orders: input.orders,
    })
    .returning();
  return serializeSpend(row!, null);
}

export async function updateSpend(
  db: Database,
  organizationId: string,
  spendId: string,
  input: { spend?: number; orders?: number },
): Promise<NumbatrakAdSpendEntry | null> {
  const values: Partial<typeof numbatrakAdSpend.$inferInsert> = { updatedAt: new Date() };
  if (input.spend !== undefined) values.spend = String(input.spend);
  if (input.orders !== undefined) values.orders = input.orders;
  const [row] = await db
    .update(numbatrakAdSpend)
    .set(values)
    .where(and(eq(numbatrakAdSpend.id, spendId), eq(numbatrakAdSpend.organizationId, organizationId)))
    .returning();
  if (!row) return null;
  return serializeSpend(row, null);
}

export async function deleteSpend(db: Database, organizationId: string, spendId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakAdSpend)
    .where(and(eq(numbatrakAdSpend.id, spendId), eq(numbatrakAdSpend.organizationId, organizationId)));
  return (result.rowCount ?? 0) > 0;
}

// --- CPA Targets ---

export async function listTargets(db: Database, organizationId: string): Promise<NumbatrakCpaTarget[]> {
  const rows = await db
    .select()
    .from(numbatrakCpaTargets)
    .where(eq(numbatrakCpaTargets.organizationId, organizationId))
    .orderBy(desc(numbatrakCpaTargets.createdAt));

  const result: NumbatrakCpaTarget[] = [];
  for (const row of rows) {
    let buyerName: string | null = null;
    if (row.buyerId) {
      const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.buyerId)).limit(1);
      buyerName = u?.name ?? null;
    }
    result.push(serializeTarget(row, buyerName));
  }
  return result;
}

export async function upsertTarget(
  db: Database,
  organizationId: string,
  input: {
    buyerId?: string | null;
    brand?: string | null;
    productId?: string | null;
    offerId?: string | null;
    cpaTarget: number;
    weeklyBudget: number;
  },
): Promise<NumbatrakCpaTarget> {
  const [row] = await db
    .insert(numbatrakCpaTargets)
    .values({
      organizationId,
      buyerId: input.buyerId ?? null,
      brand: input.brand ?? null,
      productId: input.productId ?? null,
      offerId: input.offerId ?? null,
      cpaTarget: String(input.cpaTarget),
      weeklyBudget: String(input.weeklyBudget),
    })
    .returning();
  return serializeTarget(row!, null);
}

export async function deleteTarget(db: Database, organizationId: string, targetId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakCpaTargets)
    .where(and(eq(numbatrakCpaTargets.id, targetId), eq(numbatrakCpaTargets.organizationId, organizationId)));
  return (result.rowCount ?? 0) > 0;
}

// --- Weekly Reviews ---

export async function listReviews(db: Database, organizationId: string): Promise<NumbatrakWeeklyReview[]> {
  const rows = await db
    .select({ review: numbatrakWeeklyReviews, buyerName: user.name })
    .from(numbatrakWeeklyReviews)
    .innerJoin(user, eq(numbatrakWeeklyReviews.buyerId, user.id))
    .where(eq(numbatrakWeeklyReviews.organizationId, organizationId))
    .orderBy(desc(numbatrakWeeklyReviews.weekStart));
  return rows.map((r) => serializeReview(r.review, r.buyerName));
}

export async function createReview(
  db: Database,
  organizationId: string,
  buyerId: string,
  input: {
    weekStart: string;
    adsToScale?: string | null;
    adsToPause?: string | null;
    adsToKill?: string | null;
    biggestWin?: string | null;
    biggestIssue?: string | null;
    verdict: string;
    nextWeekDecisions?: string | null;
  },
): Promise<NumbatrakWeeklyReview> {
  const [row] = await db
    .insert(numbatrakWeeklyReviews)
    .values({
      organizationId,
      buyerId,
      weekStart: input.weekStart,
      adsToScale: input.adsToScale ?? null,
      adsToPause: input.adsToPause ?? null,
      adsToKill: input.adsToKill ?? null,
      biggestWin: input.biggestWin ?? null,
      biggestIssue: input.biggestIssue ?? null,
      verdict: input.verdict,
      nextWeekDecisions: input.nextWeekDecisions ?? null,
    })
    .returning();
  return serializeReview(row!, null);
}

// --- Performance Analytics ---

export async function getPerformanceAnalytics(
  db: Database,
  organizationId: string,
): Promise<NumbatrakPerformanceAnalytics[]> {
  const rows = await db
    .select({
      brand: numbatrakAdSpend.brand,
      productId: numbatrakAdSpend.productId,
      offerId: numbatrakAdSpend.offerId,
      platform: numbatrakAdSpend.platform,
      buyerName: user.name,
      totalSpend: sql<number>`COALESCE(SUM(${numbatrakAdSpend.spend}::numeric), 0)::float`,
      totalOrders: sql<number>`COALESCE(SUM(${numbatrakAdSpend.orders}), 0)::int`,
    })
    .from(numbatrakAdSpend)
    .leftJoin(user, eq(numbatrakAdSpend.buyerId, user.id))
    .where(eq(numbatrakAdSpend.organizationId, organizationId))
    .groupBy(numbatrakAdSpend.brand, numbatrakAdSpend.productId, numbatrakAdSpend.offerId, numbatrakAdSpend.platform, user.name);

  return rows.map((r) => ({
    brand: r.brand,
    productId: r.productId,
    offerId: r.offerId,
    platform: r.platform,
    buyerName: r.buyerName,
    totalSpend: r.totalSpend,
    totalOrders: r.totalOrders,
    cpa: r.totalOrders > 0 ? r.totalSpend / r.totalOrders : 0,
    revenue: 0,
    roas: 0,
  }));
}
