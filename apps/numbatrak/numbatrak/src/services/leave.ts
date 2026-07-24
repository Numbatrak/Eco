"use client";

import { apiRequest } from "../lib/apiClient";

export interface LeaveSettings {
  id: string;
  annual_days: number;
  sick_days: number;
  emergency_days: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeaveBalance {
  staff_id: string;
  staff_name: string | null;
  year: number;
  annual_entitled: number;
  annual_used: number;
  annual_remaining: number;
  sick_entitled: number;
  sick_used: number;
  sick_remaining: number;
  emergency_entitled: number;
  emergency_used: number;
  emergency_remaining: number;
  unpaid_used: number;
}

export interface LeaveRequest {
  id: string;
  staff_id: string;
  staff_name: string | null;
  leave_type: "annual" | "sick" | "emergency" | "unpaid";
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "declined";
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SettingsDto {
  id: string;
  annualDays: number;
  sickDays: number;
  emergencyDays: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface BalanceDto {
  staffId: string;
  staffName: string | null;
  year: number;
  annualEntitled: number;
  annualUsed: number;
  annualRemaining: number;
  sickEntitled: number;
  sickUsed: number;
  sickRemaining: number;
  emergencyEntitled: number;
  emergencyUsed: number;
  emergencyRemaining: number;
  unpaidUsed: number;
}

interface RequestDto {
  id: string;
  staffId: string;
  staffName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function settingsFromDto(dto: SettingsDto): LeaveSettings {
  return {
    id: dto.id,
    annual_days: dto.annualDays,
    sick_days: dto.sickDays,
    emergency_days: dto.emergencyDays,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function balanceFromDto(dto: BalanceDto): LeaveBalance {
  return {
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    year: dto.year,
    annual_entitled: dto.annualEntitled,
    annual_used: dto.annualUsed,
    annual_remaining: dto.annualRemaining,
    sick_entitled: dto.sickEntitled,
    sick_used: dto.sickUsed,
    sick_remaining: dto.sickRemaining,
    emergency_entitled: dto.emergencyEntitled,
    emergency_used: dto.emergencyUsed,
    emergency_remaining: dto.emergencyRemaining,
    unpaid_used: dto.unpaidUsed,
  };
}

function requestFromDto(dto: RequestDto): LeaveRequest {
  return {
    id: dto.id,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    leave_type: dto.leaveType as LeaveRequest["leave_type"],
    start_date: dto.startDate,
    end_date: dto.endDate,
    days: dto.days,
    reason: dto.reason,
    status: dto.status as LeaveRequest["status"],
    decided_by: dto.decidedBy,
    decided_by_name: dto.decidedByName,
    decided_at: dto.decidedAt,
    decision_note: dto.decisionNote,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchLeaveSettings(): Promise<LeaveSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/leave/settings");
  return settingsFromDto(dto);
}

export async function updateLeaveSettings(input: {
  annualDays?: number;
  sickDays?: number;
  emergencyDays?: number;
}): Promise<LeaveSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/leave/settings", {
    method: "PATCH",
    body: input,
  });
  return settingsFromDto(dto);
}

export async function fetchLeaveBalances(year?: number): Promise<LeaveBalance[]> {
  const qs = year ? `?year=${year}` : "";
  const { balances } = await apiRequest<{ balances: BalanceDto[] }>(`/org/numbatrak/leave/balances${qs}`);
  return balances.map(balanceFromDto);
}

export async function fetchLeaveRequests(status?: string, staffId?: string): Promise<LeaveRequest[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (staffId) params.set("staffId", staffId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const { requests } = await apiRequest<{ requests: RequestDto[] }>(`/org/numbatrak/leave/requests${qs}`);
  return requests.map(requestFromDto);
}

export async function createLeaveRequest(input: {
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string | null;
  staffId?: string;
}): Promise<LeaveRequest> {
  const dto = await apiRequest<RequestDto>("/org/numbatrak/leave/requests", {
    method: "POST",
    body: input,
  });
  return requestFromDto(dto);
}

export async function decideLeaveRequest(
  requestId: string,
  status: "approved" | "declined",
  decisionNote?: string | null,
): Promise<LeaveRequest> {
  const dto = await apiRequest<RequestDto>(`/org/numbatrak/leave/requests/${requestId}`, {
    method: "PATCH",
    body: { status, decisionNote },
  });
  return requestFromDto(dto);
}
