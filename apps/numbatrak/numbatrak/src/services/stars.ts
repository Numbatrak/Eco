"use client";

import { apiRequest } from "../lib/apiClient";

export interface StarSettings {
  id: string;
  enabled: boolean;
  sotm_enabled: boolean;
  sotm_criteria: string;
  sotm_min_star_tier: number;
  sotm_winner_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StarTier {
  id: string;
  name: string;
  min_points: number;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StarRecord {
  id: string;
  staff_id: string;
  staff_name: string | null;
  points: number;
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
  total_points: number;
  tier_name: string | null;
  rank: number;
}

interface SettingsDto {
  id: string;
  enabled: boolean;
  sotmEnabled: boolean;
  sotmCriteria: string;
  sotmMinStarTier: number;
  sotmWinnerCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TierDto {
  id: string;
  name: string;
  minPoints: number;
  displayOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface StarDto {
  id: string;
  staffId: string;
  staffName: string | null;
  points: number;
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
  totalPoints: number;
  tierName: string | null;
  rank: number;
}

function settingsFromDto(dto: SettingsDto): StarSettings {
  return {
    id: dto.id,
    enabled: dto.enabled,
    sotm_enabled: dto.sotmEnabled,
    sotm_criteria: dto.sotmCriteria,
    sotm_min_star_tier: dto.sotmMinStarTier,
    sotm_winner_count: dto.sotmWinnerCount,
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
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function starFromDto(dto: StarDto): StarRecord {
  return {
    id: dto.id,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    points: dto.points,
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
    total_points: dto.totalPoints,
    tier_name: dto.tierName,
    rank: dto.rank,
  };
}

export async function fetchStarSettings(): Promise<StarSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/stars/settings");
  return settingsFromDto(dto);
}

export async function updateStarSettings(input: Record<string, unknown>): Promise<StarSettings> {
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

export async function createStarTier(input: { name: string; minPoints: number; displayOrder?: number }): Promise<StarTier> {
  const dto = await apiRequest<TierDto>("/org/numbatrak/stars/tiers", {
    method: "POST",
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

export async function awardStar(staffId: string, points: number, reason: string): Promise<StarRecord> {
  const dto = await apiRequest<StarDto>("/org/numbatrak/stars", {
    method: "POST",
    body: { staffId, points, reason },
  });
  return starFromDto(dto);
}

export async function fetchLeaderboard(month?: string): Promise<LeaderboardEntry[]> {
  const qs = month ? `?month=${month}` : "";
  const { leaderboard } = await apiRequest<{ leaderboard: LeaderboardDto[] }>(`/org/numbatrak/stars/leaderboard${qs}`);
  return leaderboard.map(leaderboardFromDto);
}
