"use client";

import { apiRequest } from "../lib/apiClient";

export interface StrikeSettings {
  id: string;
  threshold: number;
  threshold_period: "month" | "quarter" | "year";
  consequence: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Strike {
  id: string;
  staff_id: string;
  staff_name: string | null;
  reason: string;
  issued_by: string | null;
  issued_by_name: string | null;
  issued_at: string;
  cleared: boolean;
  cleared_by: string | null;
  cleared_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SettingsDto {
  id: string;
  threshold: number;
  thresholdPeriod: string;
  consequence: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface StrikeDto {
  id: string;
  staffId: string;
  staffName: string | null;
  reason: string;
  issuedBy: string | null;
  issuedByName: string | null;
  issuedAt: string;
  cleared: boolean;
  clearedBy: string | null;
  clearedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function settingsFromDto(dto: SettingsDto): StrikeSettings {
  return {
    id: dto.id,
    threshold: dto.threshold,
    threshold_period: dto.thresholdPeriod as StrikeSettings["threshold_period"],
    consequence: dto.consequence,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function strikeFromDto(dto: StrikeDto): Strike {
  return {
    id: dto.id,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    reason: dto.reason,
    issued_by: dto.issuedBy,
    issued_by_name: dto.issuedByName,
    issued_at: dto.issuedAt,
    cleared: dto.cleared,
    cleared_by: dto.clearedBy,
    cleared_at: dto.clearedAt,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchStrikeSettings(): Promise<StrikeSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/strikes/settings");
  return settingsFromDto(dto);
}

export async function updateStrikeSettings(input: {
  threshold?: number;
  thresholdPeriod?: string;
  consequence?: string;
}): Promise<StrikeSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/strikes/settings", {
    method: "PATCH",
    body: input,
  });
  return settingsFromDto(dto);
}

export async function fetchStrikes(): Promise<Strike[]> {
  const { strikes } = await apiRequest<{ strikes: StrikeDto[] }>("/org/numbatrak/strikes");
  return strikes.map(strikeFromDto);
}

export async function issueStrikes(staffIds: string[], reason: string): Promise<Strike[]> {
  const { strikes } = await apiRequest<{ strikes: StrikeDto[] }>("/org/numbatrak/strikes", {
    method: "POST",
    body: { staffIds, reason },
  });
  return strikes.map(strikeFromDto);
}

export async function clearStrike(strikeId: string): Promise<Strike> {
  const dto = await apiRequest<StrikeDto>(`/org/numbatrak/strikes/${strikeId}`, {
    method: "DELETE",
  });
  return strikeFromDto(dto);
}
