"use client";

import { apiRequest } from "../lib/apiClient";

export interface DeliveryFeeRule {
  id: string;
  /** null = the org's default/fallback rule. */
  state: string | null;
  fee: number;
  created_at: string | null;
  updated_at: string | null;
}

interface RuleDto {
  id: string;
  state: string | null;
  fee: number;
  createdAt: string | null;
  updatedAt: string | null;
}

function ruleFromDto(dto: RuleDto): DeliveryFeeRule {
  return {
    id: dto.id,
    state: dto.state,
    fee: dto.fee,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchDeliveryFeeRules(): Promise<DeliveryFeeRule[]> {
  const { rules } = await apiRequest<{ rules: RuleDto[] }>("/org/numbatrak/delivery-fee-rules");
  return rules.map(ruleFromDto);
}

export async function upsertDeliveryFeeRule(state: string | null, fee: number): Promise<DeliveryFeeRule> {
  const dto = await apiRequest<RuleDto>("/org/numbatrak/delivery-fee-rules", {
    method: "POST",
    body: { state, fee },
  });
  return ruleFromDto(dto);
}

export async function deleteDeliveryFeeRule(ruleId: string): Promise<void> {
  await apiRequest(`/org/numbatrak/delivery-fee-rules/${ruleId}`, { method: "DELETE" });
}
