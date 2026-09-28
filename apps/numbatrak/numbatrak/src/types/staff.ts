import type { SpecRole } from "../utils/specRoles";

export type EmploymentStatus = "active" | "inactive" | "suspended" | "on_leave";

export interface Staff {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  /** Real Better-Auth org role (owner/admin/manager/csr/editor/viewer) - the actual permission gate. */
  member_role: string | null;
  primary_role: SpecRole;
  extra_roles: SpecRole[];
  sub_brands: string[];
  phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  active: boolean;
  employment_status: EmploymentStatus;
  on_probation: boolean;
  probation_ends_at: string | null;
  deactivated_at: string | null;
  deactivated_by_name: string | null;
  deactivation_reason: string | null;
  manager_id: string | null;
  manager_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EligibleMember {
  user_id: string;
  name: string;
  email: string;
  member_role: string;
  has_staff_record: boolean;
}
