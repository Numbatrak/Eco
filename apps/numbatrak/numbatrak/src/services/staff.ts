"use client";

import { apiRequest } from "../lib/apiClient";
import type { EligibleMember, EmploymentStatus, Staff } from "../types/staff";
import type { SpecRole } from "../utils/specRoles";
import { emptyWithoutOrg } from "./orgQuery";

/** Wire shape returned by /org/numbatrak/staff* (camelCase, per apps/api convention). */
interface StaffDto {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  memberRole: string | null;
  primaryRole: SpecRole;
  extraRoles: SpecRole[];
  subBrands: string[];
  phone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  active: boolean;
  employmentStatus: EmploymentStatus;
  onProbation: boolean;
  probationEndsAt: string | null;
  deactivatedAt: string | null;
  deactivatedByName: string | null;
  deactivationReason: string | null;
  managerId: string | null;
  managerName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface EligibleMemberDto {
  userId: string;
  name: string;
  email: string;
  memberRole: string;
  hasStaffRecord: boolean;
}

function fromDto(dto: StaffDto): Staff {
  return {
    id: dto.id,
    user_id: dto.userId,
    user_name: dto.userName,
    user_email: dto.userEmail,
    member_role: dto.memberRole,
    primary_role: dto.primaryRole,
    extra_roles: dto.extraRoles,
    sub_brands: dto.subBrands,
    phone: dto.phone,
    bank_name: dto.bankName,
    bank_account_number: dto.bankAccountNumber,
    bank_account_name: dto.bankAccountName,
    active: dto.active,
    employment_status: dto.employmentStatus,
    on_probation: dto.onProbation,
    probation_ends_at: dto.probationEndsAt,
    deactivated_at: dto.deactivatedAt,
    deactivated_by_name: dto.deactivatedByName,
    deactivation_reason: dto.deactivationReason,
    manager_id: dto.managerId,
    manager_name: dto.managerName,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function eligibleFromDto(dto: EligibleMemberDto): EligibleMember {
  return {
    user_id: dto.userId,
    name: dto.name,
    email: dto.email,
    member_role: dto.memberRole,
    has_staff_record: dto.hasStaffRecord,
  };
}

export async function fetchStaff(organizationId: string | null): Promise<Staff[]> {
  const empty = emptyWithoutOrg<Staff>(organizationId);
  if (empty) return empty;

  const { staff } = await apiRequest<{ staff: StaffDto[] }>("/org/numbatrak/staff");
  return staff.map(fromDto);
}

export async function fetchEligibleMembers(): Promise<EligibleMember[]> {
  const { members } = await apiRequest<{ members: EligibleMemberDto[] }>(
    "/org/numbatrak/staff/eligible-members"
  );
  return members.map(eligibleFromDto);
}

export async function createStaff(input: {
  user_id: string;
  primary_role: SpecRole;
  extra_roles?: SpecRole[];
  sub_brands?: string[];
  phone?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  manager_id?: string | null;
}): Promise<Staff> {
  const dto = await apiRequest<StaffDto>("/org/numbatrak/staff", {
    method: "POST",
    body: {
      userId: input.user_id,
      primaryRole: input.primary_role,
      extraRoles: input.extra_roles ?? [],
      subBrands: input.sub_brands ?? [],
      phone: input.phone ?? null,
      bankName: input.bank_name ?? null,
      bankAccountNumber: input.bank_account_number ?? null,
      bankAccountName: input.bank_account_name ?? null,
      managerId: input.manager_id ?? null,
    },
  });
  return fromDto(dto);
}

export async function updateStaff(
  staffId: string,
  input: {
    primary_role?: SpecRole;
    extra_roles?: SpecRole[];
    sub_brands?: string[];
    phone?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_name?: string | null;
    manager_id?: string | null;
    employment_status?: EmploymentStatus;
    deactivation_reason?: string | null;
    on_probation?: boolean;
    probation_ends_at?: string | null;
  }
): Promise<Staff> {
  const dto = await apiRequest<StaffDto>(`/org/numbatrak/staff/${staffId}`, {
    method: "PATCH",
    body: {
      primaryRole: input.primary_role,
      extraRoles: input.extra_roles,
      subBrands: input.sub_brands,
      phone: input.phone,
      bankName: input.bank_name,
      bankAccountNumber: input.bank_account_number,
      bankAccountName: input.bank_account_name,
      managerId: input.manager_id,
      employmentStatus: input.employment_status,
      deactivationReason: input.deactivation_reason,
      onProbation: input.on_probation,
      probationEndsAt: input.probation_ends_at,
    },
  });
  return fromDto(dto);
}

export async function setStaffActive(staffId: string, active: boolean): Promise<Staff> {
  const dto = await apiRequest<StaffDto>(`/org/numbatrak/staff/${staffId}/active`, {
    method: "PATCH",
    body: { active },
  });
  return fromDto(dto);
}

/** Self-service: the logged-in staff member updates only their own bank details. */
export async function updateMyBankDetails(input: {
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
}): Promise<Staff> {
  const dto = await apiRequest<StaffDto>("/org/numbatrak/staff/me/bank-details", {
    method: "PATCH",
    body: {
      bankName: input.bank_name,
      bankAccountNumber: input.bank_account_number,
      bankAccountName: input.bank_account_name,
    },
  });
  return fromDto(dto);
}
