"use client";

import { apiRequest } from "../lib/apiClient";

export interface OrderAssignmentSettings {
  id: string;
  assignment_method: "round_robin" | "percentage";
  last_assigned_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrderAssignmentWeight {
  id: string;
  user_id: string;
  user_name: string | null;
  percentage: number;
  is_paused: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface SettingsDto {
  id: string;
  assignmentMethod: string;
  lastAssignedUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WeightDto {
  id: string;
  userId: string;
  userName: string | null;
  percentage: number;
  isPaused: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

function settingsFromDto(dto: SettingsDto): OrderAssignmentSettings {
  return {
    id: dto.id,
    assignment_method: dto.assignmentMethod as OrderAssignmentSettings["assignment_method"],
    last_assigned_user_id: dto.lastAssignedUserId,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function weightFromDto(dto: WeightDto): OrderAssignmentWeight {
  return {
    id: dto.id,
    user_id: dto.userId,
    user_name: dto.userName,
    percentage: dto.percentage,
    is_paused: dto.isPaused,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchOrderAssignmentSettings(): Promise<OrderAssignmentSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/order-assignment/settings");
  return settingsFromDto(dto);
}

export async function updateOrderAssignmentSettings(assignmentMethod: string): Promise<OrderAssignmentSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/order-assignment/settings", {
    method: "PATCH",
    body: { assignmentMethod },
  });
  return settingsFromDto(dto);
}

export async function fetchOrderAssignmentWeights(): Promise<OrderAssignmentWeight[]> {
  const { weights } = await apiRequest<{ weights: WeightDto[] }>("/org/numbatrak/order-assignment/weights");
  return weights.map(weightFromDto);
}

export async function upsertOrderAssignmentWeight(
  userId: string,
  percentage: number,
  isPaused?: boolean,
): Promise<OrderAssignmentWeight> {
  const dto = await apiRequest<WeightDto>("/org/numbatrak/order-assignment/weights", {
    method: "POST",
    body: { userId, percentage, isPaused },
  });
  return weightFromDto(dto);
}

export async function deleteOrderAssignmentWeight(weightId: string): Promise<void> {
  await apiRequest(`/org/numbatrak/order-assignment/weights/${weightId}`, { method: "DELETE" });
}
