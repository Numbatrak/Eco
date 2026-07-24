"use client";

import { apiRequest } from "../lib/apiClient";

// --- DTO interfaces (camelCase from API) ---

interface SettingsDto {
  id: string;
  weeklyReviewEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ContractorDto {
  id: string;
  name: string;
  role: string;
  rate: number;
  active: boolean;
  piecesDone: number;
  piecesPaid: number;
  piecesUnpaid: number;
  amountOwed: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface BatchDto {
  id: string;
  buyerId: string | null;
  buyerName: string | null;
  brand: string | null;
  productId: string | null;
  creativeType: string;
  description: string | null;
  voArtistId: string | null;
  voArtistName: string | null;
  editorId: string | null;
  editorName: string | null;
  videoCount: number;
  status: string;
  driveLink: string | null;
  doneAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PaymentDto {
  id: string;
  contractorId: string;
  contractorName: string | null;
  pieces: number;
  amount: number;
  brand: string | null;
  paidAt: string;
  createdAt: string | null;
}

interface AdDto {
  id: string;
  batchId: string | null;
  name: string;
  hookType: string | null;
  creativeType: string | null;
  brand: string | null;
  productId: string | null;
  offerId: string | null;
  driveLink: string | null;
  editorName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface SpendDto {
  id: string;
  buyerId: string | null;
  buyerName: string | null;
  spendDate: string;
  brand: string | null;
  productId: string | null;
  offerId: string | null;
  platform: string | null;
  spend: number;
  orders: number;
  cpa: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TargetDto {
  id: string;
  buyerId: string | null;
  buyerName: string | null;
  brand: string | null;
  productId: string | null;
  offerId: string | null;
  cpaTarget: number;
  weeklyBudget: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ReviewDto {
  id: string;
  buyerId: string;
  buyerName: string | null;
  weekStart: string;
  adsToScale: string | null;
  adsToPause: string | null;
  adsToKill: string | null;
  biggestWin: string | null;
  biggestIssue: string | null;
  verdict: string;
  nextWeekDecisions: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AnalyticsDto {
  brand: string | null;
  productId: string | null;
  offerId: string | null;
  platform: string | null;
  buyerName: string | null;
  totalSpend: number;
  totalOrders: number;
  cpa: number;
  revenue: number;
  roas: number;
}

// --- Frontend types (snake_case) ---

export interface MediaBuyerSettings {
  id: string;
  weekly_review_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Contractor {
  id: string;
  name: string;
  role: string;
  rate: number;
  active: boolean;
  pieces_done: number;
  pieces_paid: number;
  pieces_unpaid: number;
  amount_owed: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductionBatch {
  id: string;
  buyer_id: string | null;
  buyer_name: string | null;
  brand: string | null;
  product_id: string | null;
  creative_type: string;
  description: string | null;
  vo_artist_id: string | null;
  vo_artist_name: string | null;
  editor_id: string | null;
  editor_name: string | null;
  video_count: number;
  status: string;
  drive_link: string | null;
  done_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContractorPayment {
  id: string;
  contractor_id: string;
  contractor_name: string | null;
  pieces: number;
  amount: number;
  brand: string | null;
  paid_at: string;
  created_at: string | null;
}

export interface AdCatalogEntry {
  id: string;
  batch_id: string | null;
  name: string;
  hook_type: string | null;
  creative_type: string | null;
  brand: string | null;
  product_id: string | null;
  offer_id: string | null;
  drive_link: string | null;
  editor_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdSpendEntry {
  id: string;
  buyer_id: string | null;
  buyer_name: string | null;
  spend_date: string;
  brand: string | null;
  product_id: string | null;
  offer_id: string | null;
  platform: string | null;
  spend: number;
  orders: number;
  cpa: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CpaTarget {
  id: string;
  buyer_id: string | null;
  buyer_name: string | null;
  brand: string | null;
  product_id: string | null;
  offer_id: string | null;
  cpa_target: number;
  weekly_budget: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface WeeklyReview {
  id: string;
  buyer_id: string;
  buyer_name: string | null;
  week_start: string;
  ads_to_scale: string | null;
  ads_to_pause: string | null;
  ads_to_kill: string | null;
  biggest_win: string | null;
  biggest_issue: string | null;
  verdict: string;
  next_week_decisions: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PerformanceAnalytics {
  brand: string | null;
  product_id: string | null;
  offer_id: string | null;
  platform: string | null;
  buyer_name: string | null;
  total_spend: number;
  total_orders: number;
  cpa: number;
  revenue: number;
  roas: number;
}

// --- Converters ---

function settingsFromDto(d: SettingsDto): MediaBuyerSettings {
  return { id: d.id, weekly_review_enabled: d.weeklyReviewEnabled, created_at: d.createdAt, updated_at: d.updatedAt };
}
function contractorFromDto(d: ContractorDto): Contractor {
  return { id: d.id, name: d.name, role: d.role, rate: d.rate, active: d.active, pieces_done: d.piecesDone, pieces_paid: d.piecesPaid, pieces_unpaid: d.piecesUnpaid, amount_owed: d.amountOwed, created_at: d.createdAt, updated_at: d.updatedAt };
}
function batchFromDto(d: BatchDto): ProductionBatch {
  return { id: d.id, buyer_id: d.buyerId, buyer_name: d.buyerName, brand: d.brand, product_id: d.productId, creative_type: d.creativeType, description: d.description, vo_artist_id: d.voArtistId, vo_artist_name: d.voArtistName, editor_id: d.editorId, editor_name: d.editorName, video_count: d.videoCount, status: d.status, drive_link: d.driveLink, done_at: d.doneAt, created_at: d.createdAt, updated_at: d.updatedAt };
}
function paymentFromDto(d: PaymentDto): ContractorPayment {
  return { id: d.id, contractor_id: d.contractorId, contractor_name: d.contractorName, pieces: d.pieces, amount: d.amount, brand: d.brand, paid_at: d.paidAt, created_at: d.createdAt };
}
function adFromDto(d: AdDto): AdCatalogEntry {
  return { id: d.id, batch_id: d.batchId, name: d.name, hook_type: d.hookType, creative_type: d.creativeType, brand: d.brand, product_id: d.productId, offer_id: d.offerId, drive_link: d.driveLink, editor_name: d.editorName, created_at: d.createdAt, updated_at: d.updatedAt };
}
function spendFromDto(d: SpendDto): AdSpendEntry {
  return { id: d.id, buyer_id: d.buyerId, buyer_name: d.buyerName, spend_date: d.spendDate, brand: d.brand, product_id: d.productId, offer_id: d.offerId, platform: d.platform, spend: d.spend, orders: d.orders, cpa: d.cpa, created_at: d.createdAt, updated_at: d.updatedAt };
}
function targetFromDto(d: TargetDto): CpaTarget {
  return { id: d.id, buyer_id: d.buyerId, buyer_name: d.buyerName, brand: d.brand, product_id: d.productId, offer_id: d.offerId, cpa_target: d.cpaTarget, weekly_budget: d.weeklyBudget, created_at: d.createdAt, updated_at: d.updatedAt };
}
function reviewFromDto(d: ReviewDto): WeeklyReview {
  return { id: d.id, buyer_id: d.buyerId, buyer_name: d.buyerName, week_start: d.weekStart, ads_to_scale: d.adsToScale, ads_to_pause: d.adsToPause, ads_to_kill: d.adsToKill, biggest_win: d.biggestWin, biggest_issue: d.biggestIssue, verdict: d.verdict, next_week_decisions: d.nextWeekDecisions, created_at: d.createdAt, updated_at: d.updatedAt };
}
function analyticsFromDto(d: AnalyticsDto): PerformanceAnalytics {
  return { brand: d.brand, product_id: d.productId, offer_id: d.offerId, platform: d.platform, buyer_name: d.buyerName, total_spend: d.totalSpend, total_orders: d.totalOrders, cpa: d.cpa, revenue: d.revenue, roas: d.roas };
}

// --- API calls ---

export async function fetchMediaBuyerSettings(): Promise<MediaBuyerSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/media-buyers/settings");
  return settingsFromDto(dto);
}

export async function updateMediaBuyerSettings(weeklyReviewEnabled: boolean): Promise<MediaBuyerSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/media-buyers/settings", { method: "PATCH", body: { weeklyReviewEnabled } });
  return settingsFromDto(dto);
}

export async function fetchContractors(): Promise<Contractor[]> {
  const { contractors } = await apiRequest<{ contractors: ContractorDto[] }>("/org/numbatrak/media-buyers/contractors");
  return contractors.map(contractorFromDto);
}

export async function createContractor(name: string, role: string, rate: number): Promise<Contractor> {
  const dto = await apiRequest<ContractorDto>("/org/numbatrak/media-buyers/contractors", { method: "POST", body: { name, role, rate } });
  return contractorFromDto(dto);
}

export async function deleteContractor(id: string): Promise<void> {
  await apiRequest(`/org/numbatrak/media-buyers/contractors/${id}`, { method: "DELETE" });
}

export async function fetchBatches(): Promise<ProductionBatch[]> {
  const { batches } = await apiRequest<{ batches: BatchDto[] }>("/org/numbatrak/media-buyers/batches");
  return batches.map(batchFromDto);
}

export async function createBatch(body: Record<string, unknown>): Promise<ProductionBatch> {
  const dto = await apiRequest<BatchDto>("/org/numbatrak/media-buyers/batches", { method: "POST", body });
  return batchFromDto(dto);
}

export async function markBatchDone(batchId: string, driveLink?: string): Promise<ProductionBatch> {
  const dto = await apiRequest<BatchDto>(`/org/numbatrak/media-buyers/batches/${batchId}/done`, { method: "POST", body: { driveLink } });
  return batchFromDto(dto);
}

export async function fetchPayments(): Promise<ContractorPayment[]> {
  const { payments } = await apiRequest<{ payments: PaymentDto[] }>("/org/numbatrak/media-buyers/payments");
  return payments.map(paymentFromDto);
}

export async function payContractor(contractorId: string, pieces: number, amount: number, brand?: string | null): Promise<ContractorPayment> {
  const dto = await apiRequest<PaymentDto>("/org/numbatrak/media-buyers/payments", { method: "POST", body: { contractorId, pieces, amount, brand } });
  return paymentFromDto(dto);
}

export async function fetchAds(): Promise<AdCatalogEntry[]> {
  const { ads } = await apiRequest<{ ads: AdDto[] }>("/org/numbatrak/media-buyers/ads");
  return ads.map(adFromDto);
}

export async function fetchSpend(): Promise<AdSpendEntry[]> {
  const { entries } = await apiRequest<{ entries: SpendDto[] }>("/org/numbatrak/media-buyers/spend");
  return entries.map(spendFromDto);
}

export async function createSpend(body: Record<string, unknown>): Promise<AdSpendEntry> {
  const dto = await apiRequest<SpendDto>("/org/numbatrak/media-buyers/spend", { method: "POST", body });
  return spendFromDto(dto);
}

export async function updateSpend(id: string, body: { spend?: number; orders?: number }): Promise<AdSpendEntry> {
  const dto = await apiRequest<SpendDto>(`/org/numbatrak/media-buyers/spend/${id}`, { method: "PATCH", body });
  return spendFromDto(dto);
}

export async function deleteSpend(id: string): Promise<void> {
  await apiRequest(`/org/numbatrak/media-buyers/spend/${id}`, { method: "DELETE" });
}

export async function fetchTargets(): Promise<CpaTarget[]> {
  const { targets } = await apiRequest<{ targets: TargetDto[] }>("/org/numbatrak/media-buyers/targets");
  return targets.map(targetFromDto);
}

export async function upsertTarget(body: Record<string, unknown>): Promise<CpaTarget> {
  const dto = await apiRequest<TargetDto>("/org/numbatrak/media-buyers/targets", { method: "POST", body });
  return targetFromDto(dto);
}

export async function deleteTarget(id: string): Promise<void> {
  await apiRequest(`/org/numbatrak/media-buyers/targets/${id}`, { method: "DELETE" });
}

export async function fetchReviews(): Promise<WeeklyReview[]> {
  const { reviews } = await apiRequest<{ reviews: ReviewDto[] }>("/org/numbatrak/media-buyers/reviews");
  return reviews.map(reviewFromDto);
}

export async function createReview(body: Record<string, unknown>): Promise<WeeklyReview> {
  const dto = await apiRequest<ReviewDto>("/org/numbatrak/media-buyers/reviews", { method: "POST", body });
  return reviewFromDto(dto);
}

export async function fetchAnalytics(): Promise<PerformanceAnalytics[]> {
  const { analytics } = await apiRequest<{ analytics: AnalyticsDto[] }>("/org/numbatrak/media-buyers/analytics");
  return analytics.map(analyticsFromDto);
}
