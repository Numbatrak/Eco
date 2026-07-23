"use client";

import { apiRequest } from "../lib/apiClient";
import type { EligibleMember, Staff } from "../types/staff";
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
