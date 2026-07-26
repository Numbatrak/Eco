import type { SpecRole } from "../utils/specRoles";

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
