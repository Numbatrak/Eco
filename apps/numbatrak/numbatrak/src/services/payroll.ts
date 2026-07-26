"use client";

import { apiRequest } from "../lib/apiClient";

export interface PayStructure {
  id: string;
  scope_type: "role" | "staff";
  role: string | null;
  staff_id: string | null;
  staff_name: string | null;
  base_salary_enabled: boolean;
  base_salary_amount: number;
  commission_enabled: boolean;
  commission_basis: "flat_per_order" | "percentage_of_sale" | null;
  commission_rate: number;
  commission_gate_enabled: boolean;
  commission_gate_threshold_percent: number;
  upsell_bonus_enabled: boolean;
  upsell_bonus_amount: number;
  sotm_bonus_enabled: boolean;
  sotm_bonus_amount: number;
  manager_bonus_enabled: boolean;
  manager_bonus_amount: number;
  manager_gate_enabled: boolean;
  manager_gate_team_ratio_percent: number;
  manager_gate_kpi_threshold_percent: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PayrollLine {
  id: string;
  staff_id: string;
  staff_name: string | null;
  calculated_base_salary: number;
  calculated_commission: number;
  calculated_upsell_bonus: number;
  calculated_sotm_bonus: number;
  calculated_manager_bonus: number;
  override_base_salary: number | null;
  override_commission: number | null;
  manual_adjustment: number;
  manual_adjustment_note: string | null;
  delivery_rate_percent: number | null;
  commission_gate_missed: boolean;
  upsell_count: number;
  manager_gate_missed: boolean | null;
  sotm_awarded: boolean;
  paid: boolean;
  paid_at: string | null;
  total_pay: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PayrollRun {
  id: string;
  month: string;
  lines: PayrollLine[];
  created_at: string | null;
  updated_at: string | null;
}

export interface MyEarnings {
  month: string;
  base_salary: number;
  commission_so_far: number;
  commission_gate_missed: boolean;
  delivery_rate_percent: number | null;
  commission_gate_threshold_percent: number | null;
  upsell_count: number;
  upsell_bonus_so_far: number;
  on_track_total: number;
  gate_status_message: string | null;
}

interface PayStructureDto {
  id: string;
  scopeType: string;
  role: string | null;
  staffId: string | null;
  staffName: string | null;
  baseSalaryEnabled: boolean;
  baseSalaryAmount: number;
  commissionEnabled: boolean;
  commissionBasis: string | null;
  commissionRate: number;
  commissionGateEnabled: boolean;
  commissionGateThresholdPercent: number;
  upsellBonusEnabled: boolean;
  upsellBonusAmount: number;
  sotmBonusEnabled: boolean;
  sotmBonusAmount: number;
  managerBonusEnabled: boolean;
  managerBonusAmount: number;
  managerGateEnabled: boolean;
  managerGateTeamRatioPercent: number;
  managerGateKpiThresholdPercent: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PayrollLineDto {
  id: string;
  staffId: string;
  staffName: string | null;
  calculatedBaseSalary: number;
  calculatedCommission: number;
  calculatedUpsellBonus: number;
  calculatedSotmBonus: number;
  calculatedManagerBonus: number;
  overrideBaseSalary: number | null;
  overrideCommission: number | null;
  manualAdjustment: number;
  manualAdjustmentNote: string | null;
  deliveryRatePercent: number | null;
  commissionGateMissed: boolean;
  upsellCount: number;
  managerGateMissed: boolean | null;
  sotmAwarded: boolean;
  paid: boolean;
  paidAt: string | null;
  totalPay: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PayrollRunDto {
  id: string;
  month: string;
  lines: PayrollLineDto[];
  createdAt: string | null;
  updatedAt: string | null;
}

function structureFromDto(dto: PayStructureDto): PayStructure {
  return {
    id: dto.id,
    scope_type: dto.scopeType as PayStructure["scope_type"],
    role: dto.role,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    base_salary_enabled: dto.baseSalaryEnabled,
    base_salary_amount: dto.baseSalaryAmount,
    commission_enabled: dto.commissionEnabled,
    commission_basis: dto.commissionBasis as PayStructure["commission_basis"],
    commission_rate: dto.commissionRate,
    commission_gate_enabled: dto.commissionGateEnabled,
    commission_gate_threshold_percent: dto.commissionGateThresholdPercent,
    upsell_bonus_enabled: dto.upsellBonusEnabled,
    upsell_bonus_amount: dto.upsellBonusAmount,
    sotm_bonus_enabled: dto.sotmBonusEnabled,
    sotm_bonus_amount: dto.sotmBonusAmount,
    manager_bonus_enabled: dto.managerBonusEnabled,
    manager_bonus_amount: dto.managerBonusAmount,
    manager_gate_enabled: dto.managerGateEnabled,
    manager_gate_team_ratio_percent: dto.managerGateTeamRatioPercent,
    manager_gate_kpi_threshold_percent: dto.managerGateKpiThresholdPercent,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function lineFromDto(dto: PayrollLineDto): PayrollLine {
  return {
    id: dto.id,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    calculated_base_salary: dto.calculatedBaseSalary,
    calculated_commission: dto.calculatedCommission,
    calculated_upsell_bonus: dto.calculatedUpsellBonus,
    calculated_sotm_bonus: dto.calculatedSotmBonus,
    calculated_manager_bonus: dto.calculatedManagerBonus,
    override_base_salary: dto.overrideBaseSalary,
    override_commission: dto.overrideCommission,
    manual_adjustment: dto.manualAdjustment,
    manual_adjustment_note: dto.manualAdjustmentNote,
    delivery_rate_percent: dto.deliveryRatePercent,
    commission_gate_missed: dto.commissionGateMissed,
    upsell_count: dto.upsellCount,
    manager_gate_missed: dto.managerGateMissed,
    sotm_awarded: dto.sotmAwarded,
    paid: dto.paid,
    paid_at: dto.paidAt,
    total_pay: dto.totalPay,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function runFromDto(dto: PayrollRunDto): PayrollRun {
  return {
    id: dto.id,
    month: dto.month,
    lines: dto.lines.map(lineFromDto),
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchPayStructures(): Promise<PayStructure[]> {
  const { structures } = await apiRequest<{ structures: PayStructureDto[] }>("/org/numbatrak/payroll/structures");
  return structures.map(structureFromDto);
}

export async function upsertPayStructure(input: Record<string, unknown>): Promise<PayStructure> {
  const dto = await apiRequest<PayStructureDto>("/org/numbatrak/payroll/structures", {
    method: "POST",
    body: input,
  });
  return structureFromDto(dto);
}

export async function fetchPayrollRun(month: string): Promise<PayrollRun | null> {
  try {
    const dto = await apiRequest<PayrollRunDto>(`/org/numbatrak/payroll/run/${month}`);
    return runFromDto(dto);
  } catch {
    return null;
  }
}

export async function runPayroll(month: string): Promise<PayrollRun> {
  const dto = await apiRequest<PayrollRunDto>("/org/numbatrak/payroll/run", {
    method: "POST",
    body: { month },
  });
  return runFromDto(dto);
}

export async function overridePayrollLine(
  lineId: string,
  input: { overrideBaseSalary?: number | null; overrideCommission?: number | null },
): Promise<void> {
  await apiRequest(`/org/numbatrak/payroll/lines/${lineId}/override`, {
    method: "PATCH",
    body: input,
  });
}

export async function setManualAdjustment(
  lineId: string,
  input: { manualAdjustment: number; manualAdjustmentNote?: string | null },
): Promise<void> {
  await apiRequest(`/org/numbatrak/payroll/lines/${lineId}/adjustment`, {
    method: "PATCH",
    body: input,
  });
}

export async function awardSotm(lineId: string, sotmAwarded: boolean): Promise<void> {
  await apiRequest(`/org/numbatrak/payroll/lines/${lineId}/sotm`, {
    method: "PATCH",
    body: { sotmAwarded },
  });
}

export async function markLinePaid(lineId: string, paid: boolean): Promise<void> {
  await apiRequest(`/org/numbatrak/payroll/lines/${lineId}/paid`, {
    method: "PATCH",
    body: { paid },
  });
}

export async function fetchMyEarnings(): Promise<MyEarnings | null> {
  try {
    const dto = await apiRequest<{
      month: string;
      baseSalary: number;
      commissionSoFar: number;
      commissionGateMissed: boolean;
      deliveryRatePercent: number | null;
      commissionGateThresholdPercent: number | null;
      upsellCount: number;
      upsellBonusSoFar: number;
      onTrackTotal: number;
      gateStatusMessage: string | null;
    }>("/org/numbatrak/payroll/my-earnings");
    return {
      month: dto.month,
      base_salary: dto.baseSalary,
      commission_so_far: dto.commissionSoFar,
      commission_gate_missed: dto.commissionGateMissed,
      delivery_rate_percent: dto.deliveryRatePercent,
      commission_gate_threshold_percent: dto.commissionGateThresholdPercent,
      upsell_count: dto.upsellCount,
      upsell_bonus_so_far: dto.upsellBonusSoFar,
      on_track_total: dto.onTrackTotal,
      gate_status_message: dto.gateStatusMessage,
    };
  } catch {
    return null;
  }
}
