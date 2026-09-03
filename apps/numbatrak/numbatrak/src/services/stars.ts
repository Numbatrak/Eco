"use client";

import { apiRequest } from "../lib/apiClient";

export type LeaderboardStyle = "by_tier" | "by_revenue" | "by_delivery_rate" | "by_upsells";
export type SotmCriteria =
  | "manual"
  | "highest_delivery"
  | "highest_delivery_rate"
  | "highest_revenue"
  | "highest_revenue_per_order"
  | "highest_star_tier"
  | "most_upsells";

export interface StarSettings {
  id: string;
  enabled: boolean;
  leaderboard_style: LeaderboardStyle;
  sotm_enabled: boolean;
  sotm_criteria: SotmCriteria;
  sotm_min_star_tier: number;
  sotm_strike_disqualifies: boolean;
  sotm_winner_count: number;
  sotm_prize_amount: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StarTier {
  id: string;
  name: string;
  min_points: number;
  display_order: number;
  criteria: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StarRecord {
  id: string;
  staff_id: string;
  staff_name: string | null;
  tier_id: string | null;
  tier_name: string | null;
  reason: string;
  awarded_by: string | null;
  awarded_by_name: string | null;
  awarded_at: string;
  month: string;
  created_at: string | null;
}

export interface LeaderboardEntry {
  staff_id: string;
  staff_name: string | null;
  tier_name: string | null;
  value: number;
  rank: number;
}

export interface SotmCandidate {
  staff_id: string;
  staff_name: string | null;
  tier_name: string | null;
  value: number | null;
  has_active_strike: boolean;
  eligible: boolean;
  ineligible_reason: string | null;
}

export interface SotmCandidatesResponse {
  month: string;
  criteria: SotmCriteria;
  candidates: SotmCandidate[];
}

export interface ConfirmSotmResult {
  awarded: string[];
  skipped: { staff_id: string; reason: string }[];
}

interface SettingsDto {
  id: string;
  enabled: boolean;
  leaderboardStyle: LeaderboardStyle;
  sotmEnabled: boolean;
  sotmCriteria: SotmCriteria;
  sotmMinStarTier: number;
  sotmStrikeDisqualifies: boolean;
  sotmWinnerCount: number;
  sotmPrizeAmount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TierDto {
  id: string;
  name: string;
  minPoints: number;
  displayOrder: number;
  criteria: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface StarDto {
  id: string;
  staffId: string;
  staffName: string | null;
  tierId: string | null;
  tierName: string | null;
  reason: string;
  awardedBy: string | null;
  awardedByName: string | null;
  awardedAt: string;
  month: string;
  createdAt: string | null;
}

interface LeaderboardDto {
  staffId: string;
  staffName: string | null;
  tierName: string | null;
  value: number;
  rank: number;
}

interface SotmCandidateDto {
  staffId: string;
  staffName: string | null;
  tierName: string | null;
  value: number | null;
  hasActiveStrike: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
}

interface SotmCandidatesDto {
  month: string;
  criteria: SotmCriteria;
  candidates: SotmCandidateDto[];
}

interface ConfirmSotmDto {
  awarded: string[];
  skipped: { staffId: string; reason: string }[];
}

function settingsFromDto(dto: SettingsDto): StarSettings {
  return {
    id: dto.id,
    enabled: dto.enabled,
    leaderboard_style: dto.leaderboardStyle,
    sotm_enabled: dto.sotmEnabled,
    sotm_criteria: dto.sotmCriteria,
    sotm_min_star_tier: dto.sotmMinStarTier,
    sotm_strike_disqualifies: dto.sotmStrikeDisqualifies,
    sotm_winner_count: dto.sotmWinnerCount,
    sotm_prize_amount: dto.sotmPrizeAmount,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function tierFromDto(dto: TierDto): StarTier {
  return {
    id: dto.id,
    name: dto.name,
    min_points: dto.minPoints,
    display_order: dto.displayOrder,
    criteria: dto.criteria,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function starFromDto(dto: StarDto): StarRecord {
  return {
    id: dto.id,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    tier_id: dto.tierId,
    tier_name: dto.tierName,
    reason: dto.reason,
    awarded_by: dto.awardedBy,
    awarded_by_name: dto.awardedByName,
    awarded_at: dto.awardedAt,
    month: dto.month,
    created_at: dto.createdAt,
  };
}

function leaderboardFromDto(dto: LeaderboardDto): LeaderboardEntry {
  return {
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    tier_name: dto.tierName,
    value: dto.value,
    rank: dto.rank,
  };
}

function sotmCandidateFromDto(dto: SotmCandidateDto): SotmCandidate {
  return {
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    tier_name: dto.tierName,
    value: dto.value,
    has_active_strike: dto.hasActiveStrike,
    eligible: dto.eligible,
    ineligible_reason: dto.ineligibleReason,
  };
}

export async function fetchStarSettings(): Promise<StarSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/stars/settings");
  return settingsFromDto(dto);
}

export async function updateStarSettings(input: {
  enabled?: boolean;
  leaderboardStyle?: LeaderboardStyle;
  sotmEnabled?: boolean;
  sotmCriteria?: SotmCriteria;
  sotmMinStarTier?: number;
  sotmStrikeDisqualifies?: boolean;
  sotmWinnerCount?: number;
  sotmPrizeAmount?: number;
}): Promise<StarSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/stars/settings", {
    method: "PATCH",
    body: input,
  });
  return settingsFromDto(dto);
}

export async function fetchStarTiers(): Promise<StarTier[]> {
  const { tiers } = await apiRequest<{ tiers: TierDto[] }>("/org/numbatrak/stars/tiers");
  return tiers.map(tierFromDto);
}

export async function createStarTier(input: {
  name: string;
  minPoints: number;
  displayOrder?: number;
  criteria?: string | null;
}): Promise<StarTier> {
  const dto = await apiRequest<TierDto>("/org/numbatrak/stars/tiers", {
    method: "POST",
    body: input,
  });
  return tierFromDto(dto);
}

export async function updateStarTier(
  tierId: string,
  input: { name?: string; minPoints?: number; displayOrder?: number; criteria?: string | null }
): Promise<StarTier> {
  const dto = await apiRequest<TierDto>(`/org/numbatrak/stars/tiers/${tierId}`, {
    method: "PATCH",
    body: input,
  });
  return tierFromDto(dto);
}

export async function deleteStarTier(tierId: string): Promise<void> {
  await apiRequest(`/org/numbatrak/stars/tiers/${tierId}`, { method: "DELETE" });
}

export async function fetchStars(month?: string): Promise<StarRecord[]> {
  const qs = month ? `?month=${month}` : "";
  const { stars } = await apiRequest<{ stars: StarDto[] }>(`/org/numbatrak/stars${qs}`);
  return stars.map(starFromDto);
}

export async function awardStar(staffId: string, tierId: string, reason: string): Promise<StarRecord> {
  const dto = await apiRequest<StarDto>("/org/numbatrak/stars", {
    method: "POST",
    body: { staffId, tierId, reason },
  });
  return starFromDto(dto);
}

export async function fetchLeaderboard(month?: string): Promise<LeaderboardEntry[]> {
  const qs = month ? `?month=${month}` : "";
  const { leaderboard } = await apiRequest<{ leaderboard: LeaderboardDto[] }>(`/org/numbatrak/stars/leaderboard${qs}`);
  return leaderboard.map(leaderboardFromDto);
}

export async function fetchSotmCandidates(month?: string): Promise<SotmCandidatesResponse> {
  const qs = month ? `?month=${month}` : "";
  const dto = await apiRequest<SotmCandidatesDto>(`/org/numbatrak/stars/sotm-candidates${qs}`);
  return { month: dto.month, criteria: dto.criteria, candidates: dto.candidates.map(sotmCandidateFromDto) };
}

export async function confirmSotm(month: string, staffIds: string[]): Promise<ConfirmSotmResult> {
  const dto = await apiRequest<ConfirmSotmDto>("/org/numbatrak/stars/sotm-confirm", {
    method: "POST",
    body: { month, staffIds },
  });
  return {
    awarded: dto.awarded,
    skipped: dto.skipped.map((s) => ({ staff_id: s.staffId, reason: s.reason })),
  };
}
